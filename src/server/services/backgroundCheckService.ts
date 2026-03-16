/**
 * backgroundCheckService.ts — Business logic for background check integration.
 *
 * initiateBackgroundCheck data flow:
 *
 *   guard: active check exists? (PENDING or CONSIDER)
 *       │ yes → throw TRPCError BAD_REQUEST
 *       │ no
 *       ▼
 *   guard: VERIFIED BACKGROUND_CHECK credential exists?
 *       │ yes → throw TRPCError BAD_REQUEST
 *       │ no
 *       ▼
 *   get org's checkrAccessToken from DB (decrypted via tryDecrypt)
 *       │ null → throw TRPCError BAD_REQUEST: "Connect Checkr first"
 *       ▼
 *   checkrAdapter.initiateCheck(pii, packageName, accessToken) ← PII ends here (OUTSIDE tx)
 *       │ CheckrApiError(422) → re-throw as TRPCError BAD_REQUEST
 *       │ CheckrApiError(other) → re-throw as TRPCError INTERNAL_SERVER_ERROR
 *       ▼
 *   prisma.$transaction(
 *     createBackgroundCheckRequestTx
 *     writeAuditLogTx
 *   )
 *       ▼
 *   return { requestId }
 *
 * Why Checkr call is OUTSIDE the transaction:
 *   Remote side effects can't be rolled back. If Checkr succeeds but the DB
 *   commit fails, the webhook requeue path handles it gracefully.
 *
 * handleCheckrWebhookEvent data flow:
 *
 *   verifySignature → (throws CheckrSignatureError → 400)
 *   JSON.parse      → (throws CheckrBadPayloadError → 400)
 *   idempotency check → (early return if duplicate)
 *   parseActionablePayload → null? → record event only
 *   find request by externalId → null? → throw CheckrRequeueError → 500
 *   isTerminalStatus? → record + log + return (no action)
 *   prisma.$transaction(
 *     markCheckrWebhookEventProcessedTx
 *     upsertCredential (if COMPLETE)
 *     updateBackgroundCheckRequestTx (status + webhookPayload + credentialId)
 *     writeAuditLogTx
 *   )
 *   sendBackgroundCheckConsiderEmail (if CONSIDER) — try/catch, never throws
 *
 * FCRA adverse action data flow:
 *
 *   sendPreAdverseNotice(requestId, orgId, actorId):
 *     guard: request exists + IDOR check
 *     guard: status=CONSIDER, fcraStatus=NONE
 *     fetch volunteer email
 *     sendPreAdverseActionEmail() ← REMOTE CALL (throws on failure)
 *     prisma.$transaction(update fcraStatus + preAdverseNoticeSentAt + audit)
 *
 *   finalizeAdverseAction(requestId, orgId, actorId):
 *     guard: request exists + IDOR check
 *     guard: status=CONSIDER, fcraStatus=PRE_ADVERSE_SENT
 *     guard: waiting period elapsed (≥5 days)
 *     fetch volunteer email
 *     sendAdverseActionEmail() ← REMOTE CALL (throws on failure)
 *     prisma.$transaction(update fcraStatus + adverseActionAt + status=FAILED + audit)
 *
 *   resolveFcra(requestId, orgId, actorId):
 *     guard: request exists + IDOR check
 *     guard: status=CONSIDER, fcraStatus=NONE or PRE_ADVERSE_SENT
 *     prisma.$transaction(update fcraStatus=RESOLVED + audit)
 */

import { TRPCError } from '@trpc/server';
import type { Prisma } from '@/prisma/generated/client';
import {
	canFinalizeAdverseAction,
	canResolveFcra,
	canSendPreAdverseNotice,
	isTerminalStatus,
	isWaitingPeriodElapsed,
	mapCheckrResultToStatus,
	sanitizeCheckrPayload,
	shouldAutoIssueCredential,
	waitingPeriodDaysRemaining,
} from '@/server/domain/background-check';
import {
	CheckrApiError,
	CheckrBadPayloadError,
	CheckrRequeueError,
	checkrAdapter,
} from '@/server/lib/adapters/background-check/checkr';
import type { CandidatePii } from '@/server/lib/adapters/background-check/types';
import { encrypt, tryDecrypt } from '@/server/lib/crypto';
import { writeAuditLogTx } from '@/server/repositories/auditRepo';
import {
	createBackgroundCheckRequestTx,
	findActiveCheckForUserInOrg,
	findBackgroundCheckByExternalId,
	findBackgroundCheckById,
	isCheckrWebhookEventProcessed,
	listBackgroundChecksByOrg,
	markCheckrWebhookEventProcessedTx,
	updateBackgroundCheckRequestTx,
} from '@/server/repositories/backgroundCheckRepo';
import { prisma } from '@/server/repositories/prisma';
import { sendBackgroundCheckConsiderEmail } from '@/server/repositories/sendBackgroundCheckEmail';
import {
	sendAdverseActionEmail,
	sendPreAdverseActionEmail,
} from '@/server/repositories/sendFcraEmails';
import {
	findCredentialByUserOrgType,
	upsertCredential,
} from '@/server/repositories/volunteerCredentialRepo';

// Re-export error classes so the webhook route can catch them
export {
	CheckrBadPayloadError,
	CheckrRequeueError,
	CheckrSignatureError,
	CheckrWebhookError,
} from '@/server/lib/adapters/background-check/checkr';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function getOrgCheckrToken(orgId: string): Promise<string | null> {
	const org = await prisma.organization.findUnique({
		where: { id: orgId },
		select: { checkrAccessToken: true },
	});
	const raw = org?.checkrAccessToken ?? null;
	if (!raw) return null;
	return tryDecrypt(raw);
}

// ---------------------------------------------------------------------------
// connectCheckrAccount
// ---------------------------------------------------------------------------

/**
 * Exchange an OAuth authorization code for a per-org Checkr access token
 * and persist it (encrypted) on the Organization record.
 *
 * Called from the OAuth callback route after Checkr redirects back.
 */
export async function connectCheckrAccount(
	orgId: string,
	code: string,
	actorId: string,
): Promise<void> {
	const { accessToken, accountId } =
		await checkrAdapter.exchangeOAuthCode(code);

	const encryptedToken = encrypt(accessToken);

	await prisma.$transaction(async (tx) => {
		await tx.organization.update({
			where: { id: orgId },
			data: { checkrAccessToken: encryptedToken, checkrAccountId: accountId },
		});
		await writeAuditLogTx(tx, {
			orgId,
			actorId,
			action: 'CHECKR_CONNECTED',
			entityType: 'Organization',
			entityId: orgId,
			metadata: { accountId },
		});
	});

	console.log(
		`[bg-check] Checkr connected orgId=${orgId} accountId=${accountId}`,
	);
}

// ---------------------------------------------------------------------------
// disconnectCheckrAccount
// ---------------------------------------------------------------------------

export async function disconnectCheckrAccount(
	orgId: string,
	actorId: string,
): Promise<void> {
	await prisma.$transaction(async (tx) => {
		await tx.organization.update({
			where: { id: orgId },
			data: { checkrAccessToken: null, checkrAccountId: null },
		});
		await writeAuditLogTx(tx, {
			orgId,
			actorId,
			action: 'CHECKR_DISCONNECTED',
			entityType: 'Organization',
			entityId: orgId,
			metadata: {},
		});
	});

	console.log(`[bg-check] Checkr disconnected orgId=${orgId}`);
}

// ---------------------------------------------------------------------------
// getCheckrConnectionStatus
// ---------------------------------------------------------------------------

export async function getCheckrConnectionStatus(
	orgId: string,
): Promise<{ connected: boolean; accountId: string | null }> {
	const org = await prisma.organization.findUnique({
		where: { id: orgId },
		select: { checkrAccessToken: true, checkrAccountId: true },
	});
	const connected = !!org?.checkrAccessToken;
	return { connected, accountId: org?.checkrAccountId ?? null };
}

// ---------------------------------------------------------------------------
// initiateBackgroundCheck
// ---------------------------------------------------------------------------

export async function initiateBackgroundCheck(input: {
	orgId: string;
	userId: string;
	actorId: string;
	pii: CandidatePii;
	packageName?: string;
}): Promise<{ requestId: string }> {
	const { orgId, userId, actorId, pii } = input;
	const packageName =
		input.packageName ??
		(process.env.CHECKR_DEFAULT_PACKAGE || 'tasker_standard');

	console.log(
		`[bg-check] Initiating check orgId=${orgId} userId=${userId} provider=CHECKR`,
	);

	// Guard 1: no active check already in flight (PENDING or CONSIDER)
	const activeCheck = await findActiveCheckForUserInOrg(userId, orgId);
	if (activeCheck) {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: `A background check is already in progress for this volunteer (status: ${activeCheck.status}).`,
		});
	}

	// Guard 2: no existing VERIFIED BACKGROUND_CHECK credential
	const existingCred = await findCredentialByUserOrgType(
		userId,
		orgId,
		'BACKGROUND_CHECK',
	);
	if (existingCred?.status === 'VERIFIED') {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message:
				'Volunteer already has a verified background check. Revoke it first.',
		});
	}

	// Guard 3: org must have connected their Checkr account (Partner API)
	const accessToken = await getOrgCheckrToken(orgId);
	if (!accessToken) {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message:
				'This organization has not connected a Checkr account. Go to Settings → Credentials and click "Connect Checkr".',
		});
	}

	// Call Checkr — OUTSIDE transaction (remote side effect, can't roll back)
	let reportId: string;
	try {
		const result = await checkrAdapter.initiateCheck(
			pii,
			packageName,
			accessToken,
		);
		reportId = result.reportId;
	} catch (err) {
		if (err instanceof CheckrApiError) {
			// NEVER log pii fields in error context
			console.error(
				`[bg-check] Checkr API error code=${err.status} status=${err.status}`,
			);
			if (err.status === 422) {
				throw new TRPCError({ code: 'BAD_REQUEST', message: err.message });
			}
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message:
					'Background check service is temporarily unavailable. Please try again.',
			});
		}
		throw err;
	}

	// Persist the request + audit log atomically
	const request = await prisma.$transaction(async (tx) => {
		const req = await createBackgroundCheckRequestTx(tx, {
			orgId,
			userId,
			externalId: reportId,
			packageName,
		});
		await writeAuditLogTx(tx, {
			orgId,
			actorId,
			action: 'BACKGROUND_CHECK_INITIATED',
			entityType: 'BackgroundCheckRequest',
			entityId: req.id,
			metadata: { provider: 'CHECKR', externalId: reportId },
		});
		return req;
	});

	console.log(
		`[bg-check] Check initiated requestId=${request.id} externalId=${reportId}`,
	);

	return { requestId: request.id };
}

// ---------------------------------------------------------------------------
// listOrgBackgroundChecks
// ---------------------------------------------------------------------------

export async function listOrgBackgroundChecks(orgId: string) {
	return listBackgroundChecksByOrg(orgId);
}

// ---------------------------------------------------------------------------
// cancelBackgroundCheck
// ---------------------------------------------------------------------------

export async function cancelBackgroundCheck(
	requestId: string,
	orgId: string,
	actorId: string,
): Promise<void> {
	const request = await prisma.backgroundCheckRequest.findUniqueOrThrow({
		where: { id: requestId },
		select: { id: true, orgId: true, userId: true, status: true },
	});

	// IDOR guard — ensure the request belongs to this org
	if (request.orgId !== orgId) {
		throw new TRPCError({ code: 'NOT_FOUND' });
	}

	if (request.status !== 'PENDING' && request.status !== 'CONSIDER') {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: `Cannot cancel a check in ${request.status} status. Only PENDING and CONSIDER checks can be cancelled.`,
		});
	}

	await prisma.$transaction(async (tx) => {
		await updateBackgroundCheckRequestTx(tx, requestId, {
			status: 'CANCELLED',
		});
		await writeAuditLogTx(tx, {
			orgId,
			actorId,
			action: 'BACKGROUND_CHECK_CANCELLED',
			entityType: 'BackgroundCheckRequest',
			entityId: requestId,
			metadata: { previousStatus: request.status },
		});
	});
}

// ---------------------------------------------------------------------------
// handleCheckrWebhookEvent
// ---------------------------------------------------------------------------

export async function handleCheckrWebhookEvent(
	rawBody: Buffer,
	signature: string,
): Promise<void> {
	// Step 1: Verify signature — throws CheckrSignatureError on failure
	checkrAdapter.verifyWebhookSignature(rawBody, signature);

	// Step 2: Parse body — wrap in try/catch to produce 400 on bad JSON
	let body: unknown;
	try {
		body = JSON.parse(rawBody.toString('utf-8'));
	} catch {
		throw new CheckrBadPayloadError('Webhook body is not valid JSON');
	}

	// Extract checkrId for idempotency
	const checkrId =
		typeof body === 'object' && body !== null
			? ((body as Record<string, unknown>).id as string | undefined)
			: undefined;

	if (!checkrId) {
		throw new CheckrBadPayloadError('Webhook payload missing event id');
	}

	const eventType =
		typeof body === 'object' && body !== null
			? ((body as Record<string, unknown>).type as string | undefined)
			: undefined;

	console.log(
		`[bg-check] Webhook received checkrId=${checkrId} type=${eventType ?? 'unknown'}`,
	);

	// Step 3: Idempotency check — early return if already processed
	if (await isCheckrWebhookEventProcessed(checkrId)) {
		console.log(`[bg-check] Webhook duplicate — skipping checkrId=${checkrId}`);
		return;
	}

	// Step 4: Parse actionable payload
	const actionable = checkrAdapter.parseActionableWebhookPayload(body);

	if (!actionable) {
		// Non-actionable event type — record it and return
		await prisma.$transaction(async (tx) => {
			await markCheckrWebhookEventProcessedTx(tx, {
				checkrId,
				type: eventType ?? 'unknown',
				payload: sanitizeCheckrPayload(body) as Prisma.InputJsonValue,
			});
		});
		return;
	}

	// Step 5: Find the corresponding request by externalId (report ID)
	const request = await findBackgroundCheckByExternalId(actionable.reportId);
	if (!request) {
		console.warn(
			`[bg-check] Requeue — unknown externalId=${actionable.reportId} (retry expected)`,
		);
		throw new CheckrRequeueError(`Unknown reportId: ${actionable.reportId}`);
	}

	// Step 6: Skip if already in a terminal status (including CANCELLED)
	if (isTerminalStatus(request.status)) {
		console.log(
			`[bg-check] Skipping webhook for terminal request requestId=${request.id} status=${request.status}`,
		);
		await prisma.$transaction(async (tx) => {
			await markCheckrWebhookEventProcessedTx(tx, {
				checkrId,
				type: eventType ?? 'unknown',
				payload: sanitizeCheckrPayload(body) as Prisma.InputJsonValue,
			});
		});
		return;
	}

	const newStatus = mapCheckrResultToStatus(actionable.result);
	const sanitizedPayload = sanitizeCheckrPayload(body) as Prisma.InputJsonValue;

	// Step 7: Atomic transaction — record event + update request + optional credential
	let credentialIssued = false;

	await prisma.$transaction(async (tx) => {
		await markCheckrWebhookEventProcessedTx(tx, {
			checkrId,
			type: eventType ?? 'unknown',
			payload: sanitizedPayload,
		});

		let credentialId: string | undefined;

		if (shouldAutoIssueCredential(newStatus)) {
			const cred = await upsertCredential(tx, {
				userId: request.userId,
				orgId: request.orgId,
				type: 'BACKGROUND_CHECK',
				status: 'VERIFIED',
				issuedAt: new Date(),
			});
			credentialId = cred.id;
			credentialIssued = true;
		}

		await updateBackgroundCheckRequestTx(tx, request.id, {
			status: newStatus,
			webhookPayload: sanitizedPayload,
			...(credentialId ? { credentialId } : {}),
		});

		await writeAuditLogTx(tx, {
			orgId: request.orgId,
			action: 'BACKGROUND_CHECK_RESULT',
			entityType: 'BackgroundCheckRequest',
			entityId: request.id,
			metadata: {
				newStatus,
				wasCredentialIssued: credentialIssued,
				checkrEventId: checkrId,
			},
		});
	});

	console.log(
		`[bg-check] Webhook result requestId=${request.id} status=${newStatus} wasCredentialIssued=${credentialIssued}`,
	);

	// Step 8: Send CONSIDER email — outside transaction, never rethrows
	if (newStatus === 'CONSIDER') {
		try {
			// Fetch org owner email for notification
			const org = await prisma.organization.findUnique({
				where: { id: request.orgId },
				select: {
					name: true,
					members: {
						where: { role: 'OWNER' },
						select: { user: { select: { email: true, name: true } } },
						take: 1,
					},
				},
			});
			const user = await prisma.user.findUnique({
				where: { id: request.userId },
				select: { name: true, email: true },
			});

			const ownerEmail = org?.members[0]?.user?.email;
			if (ownerEmail && org && user) {
				await sendBackgroundCheckConsiderEmail({
					to: ownerEmail,
					volunteerName: user.name ?? user.email ?? 'Volunteer',
					orgName: org.name,
					requestId: request.id,
				});
			}
		} catch (err) {
			console.error(
				`[bg-check] Email failed requestId=${request.id} error=${String(err)}`,
			);
			// DO NOT rethrow — email failure must not fail the webhook
		}
	}
}

// ---------------------------------------------------------------------------
// FCRA Adverse Action — sendPreAdverseNotice
// ---------------------------------------------------------------------------

/**
 * Send a pre-adverse action notice to the volunteer per FCRA requirements.
 * Email is sent FIRST — DB only updated on email success (fail-loudly).
 */
export async function sendPreAdverseNotice(
	requestId: string,
	orgId: string,
	actorId: string,
): Promise<void> {
	const request = await findBackgroundCheckById(requestId);
	if (!request || request.orgId !== orgId) {
		throw new TRPCError({ code: 'NOT_FOUND' });
	}

	if (request.status !== 'CONSIDER') {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: `Cannot send pre-adverse notice for a check in ${request.status} status.`,
		});
	}

	if (!canSendPreAdverseNotice(request.fcraStatus)) {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: `Pre-adverse notice has already been sent (FCRA status: ${request.fcraStatus}).`,
		});
	}

	const volunteerEmail = request.user.email;
	if (!volunteerEmail) {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: 'Volunteer does not have an email address on file.',
		});
	}

	// Fetch org name for the email
	const org = await prisma.organization.findUnique({
		where: { id: orgId },
		select: { name: true },
	});
	if (!org) {
		throw new TRPCError({ code: 'NOT_FOUND' });
	}

	const volunteerName = request.user.name ?? request.user.email ?? 'Volunteer';

	// Send email FIRST — throws on failure (fail-loudly for FCRA compliance)
	await sendPreAdverseActionEmail({
		to: volunteerEmail,
		volunteerName,
		orgName: org.name,
	});

	// Email succeeded — update DB with atomic guard on fcraStatus
	const now = new Date();
	await prisma.$transaction(async (tx) => {
		const { count } = await tx.backgroundCheckRequest.updateMany({
			where: { id: requestId, fcraStatus: 'NONE' },
			data: {
				fcraStatus: 'PRE_ADVERSE_SENT',
				preAdverseNoticeSentAt: now,
			},
		});
		if (count === 0) {
			throw new TRPCError({
				code: 'CONFLICT',
				message: 'Pre-adverse notice was already sent by another request.',
			});
		}
		await writeAuditLogTx(tx, {
			orgId,
			actorId,
			action: 'FCRA_PRE_ADVERSE_SENT',
			entityType: 'BackgroundCheckRequest',
			entityId: requestId,
			metadata: { volunteerEmail },
		});
	});

	console.log(
		`[bg-check] Pre-adverse notice sent requestId=${requestId} userId=${request.userId}`,
	);
}

// ---------------------------------------------------------------------------
// FCRA Adverse Action — finalizeAdverseAction
// ---------------------------------------------------------------------------

/**
 * Finalize the adverse action after the FCRA waiting period.
 * Email is sent FIRST — DB only updated on email success (fail-loudly).
 * Sets status=FAILED (terminal) alongside fcraStatus=ADVERSE_ACTION_SENT.
 */
export async function finalizeAdverseAction(
	requestId: string,
	orgId: string,
	actorId: string,
): Promise<void> {
	const request = await findBackgroundCheckById(requestId);
	if (!request || request.orgId !== orgId) {
		throw new TRPCError({ code: 'NOT_FOUND' });
	}

	if (request.status !== 'CONSIDER') {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: `Cannot finalize adverse action for a check in ${request.status} status.`,
		});
	}

	if (!canFinalizeAdverseAction(request.fcraStatus)) {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: `Cannot finalize adverse action (FCRA status: ${request.fcraStatus}). Pre-adverse notice must be sent first.`,
		});
	}

	if (!request.preAdverseNoticeSentAt) {
		throw new TRPCError({
			code: 'INTERNAL_SERVER_ERROR',
			message: 'Pre-adverse notice timestamp is missing.',
		});
	}

	const now = new Date();
	if (!isWaitingPeriodElapsed(request.preAdverseNoticeSentAt, now)) {
		const daysLeft = waitingPeriodDaysRemaining(
			request.preAdverseNoticeSentAt,
			now,
		);
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: `FCRA waiting period has not elapsed. ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining.`,
		});
	}

	const volunteerEmail = request.user.email;
	if (!volunteerEmail) {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: 'Volunteer does not have an email address on file.',
		});
	}

	const org = await prisma.organization.findUnique({
		where: { id: orgId },
		select: { name: true },
	});
	if (!org) {
		throw new TRPCError({ code: 'NOT_FOUND' });
	}

	const volunteerName = request.user.name ?? request.user.email ?? 'Volunteer';

	// Send email FIRST — throws on failure (fail-loudly for FCRA compliance)
	await sendAdverseActionEmail({
		to: volunteerEmail,
		volunteerName,
		orgName: org.name,
	});

	// Email succeeded — update DB with atomic guard on fcraStatus
	await prisma.$transaction(async (tx) => {
		const { count } = await tx.backgroundCheckRequest.updateMany({
			where: { id: requestId, fcraStatus: 'PRE_ADVERSE_SENT' },
			data: {
				status: 'FAILED',
				fcraStatus: 'ADVERSE_ACTION_SENT',
				adverseActionAt: now,
			},
		});
		if (count === 0) {
			throw new TRPCError({
				code: 'CONFLICT',
				message: 'Adverse action was already finalized or status changed.',
			});
		}
		await writeAuditLogTx(tx, {
			orgId,
			actorId,
			action: 'FCRA_ADVERSE_ACTION_FINALIZED',
			entityType: 'BackgroundCheckRequest',
			entityId: requestId,
			metadata: { volunteerEmail },
		});
	});

	console.log(
		`[bg-check] Adverse action finalized requestId=${requestId} userId=${request.userId}`,
	);
}

// ---------------------------------------------------------------------------
// FCRA — resolveFcra (favorable resolution)
// ---------------------------------------------------------------------------

/**
 * Resolve the FCRA process favorably (e.g., staff issues a credential).
 * Called by the UI after credentials.issue succeeds on a CONSIDER row.
 */
export async function resolveFcra(
	requestId: string,
	orgId: string,
	actorId: string,
): Promise<void> {
	const request = await findBackgroundCheckById(requestId);
	if (!request || request.orgId !== orgId) {
		throw new TRPCError({ code: 'NOT_FOUND' });
	}

	if (request.status !== 'CONSIDER') {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: `Cannot resolve FCRA for a check in ${request.status} status.`,
		});
	}

	if (!canResolveFcra(request.fcraStatus)) {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: `Cannot resolve FCRA (status: ${request.fcraStatus}).`,
		});
	}

	await prisma.$transaction(async (tx) => {
		// Atomic guard: only transition from NONE or PRE_ADVERSE_SENT
		const { count } = await tx.backgroundCheckRequest.updateMany({
			where: {
				id: requestId,
				fcraStatus: { in: ['NONE', 'PRE_ADVERSE_SENT'] },
			},
			data: { fcraStatus: 'RESOLVED' },
		});
		if (count === 0) {
			throw new TRPCError({
				code: 'CONFLICT',
				message: 'FCRA status was already resolved or changed.',
			});
		}
		await writeAuditLogTx(tx, {
			orgId,
			actorId,
			action: 'FCRA_RESOLVED',
			entityType: 'BackgroundCheckRequest',
			entityId: requestId,
			metadata: { previousFcraStatus: request.fcraStatus },
		});
	});

	console.log(
		`[bg-check] FCRA resolved favorably requestId=${requestId} userId=${request.userId}`,
	);
}
