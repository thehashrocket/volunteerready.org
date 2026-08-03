/**
 * backgroundCheckService.ts — Business logic for background check integration.
 *
 * initiateBackgroundCheck data flow:
 *
 *   guard: submitted email == the account's? (Guard 1.5)
 *       │ no, or no address on file → throw TRPCError BAD_REQUEST
 *       │ yes → the ACCOUNT's address is what goes to the provider below
 *       ▼
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
 *   checkrAdapter.initiateCheck({ ...pii, email: accountEmail }, packageName,
 *                               accessToken) ← PII ends here (OUTSIDE tx)
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
import { waitUntil } from '@vercel/functions';
import type { Prisma } from '@/prisma/generated/client';
import {
	canFinalizeAdverseAction,
	canResolveFcra,
	canSendPreAdverseNotice,
	isTerminalStatus,
	isWaitingPeriodElapsed,
	mapResultToStatus,
	sanitizeWebhookPayload,
	shouldAutoIssueCredential,
	submittedNameMatchesAccount,
	waitingPeriodDaysRemaining,
} from '@/server/domain/background-check';
import { normalizeEmail } from '@/server/domain/org-volunteer';
import {
	CheckrApiError,
	CheckrBadPayloadError,
	CheckrRequeueError,
	checkrAdapter,
} from '@/server/lib/adapters/background-check/checkr';
import {
	SterlingApiError,
	SterlingAuthError,
	SterlingRateLimitError,
	SterlingTimeoutError,
	SterlingValidationError,
	SterlingWebhookError,
	sterlingAdapter,
} from '@/server/lib/adapters/background-check/sterling';
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
import {
	sendBackgroundCheckConsiderEmail,
	sendBackgroundCheckInitiatedEmail,
} from '@/server/repositories/sendBackgroundCheckEmail';
import {
	sendAdverseActionEmail,
	sendPreAdverseActionEmail,
} from '@/server/repositories/sendFcraEmails';
import {
	findEmailByUserId,
	findUserIdentity,
} from '@/server/repositories/userAccountStateRepo';
import {
	findCredentialByUserOrgType,
	upsertCredential,
} from '@/server/repositories/volunteerCredentialRepo';
import { requireOrgVolunteerRelationship } from '@/server/services/orgVolunteerAccessService';
import { checkAndIssueTenureBadges } from '@/server/services/tenureBadgeService';

// Re-export error classes so the webhook routes can catch them
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
	/** Real admin user id when the actor is being impersonated (audit trail). */
	impersonatedBy?: string | null,
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
			metadata: {
				accountId,
				...(impersonatedBy ? { impersonatedBy } : {}),
			},
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
// Provider-agnostic initiateCheck
// ---------------------------------------------------------------------------

/**
 * Shared initiateCheck logic for any background check provider.
 *
 * Data flow:
 *   guard: attested? → guard: org's volunteer? → guard: identity matches? →
 *   guard: active check? → guard: existing credential? → get credentials →
 *   adapter.initiateCheck(pii) → persist request + audit log
 *
 * Provider-specific concerns are injected via the params:
 *   - adapter: the BackgroundCheckAdapter to call
 *   - accessToken: the per-org credential (OAuth token for Checkr, API key for Sterling)
 *   - provider: the enum value for DB records
 *   - apiErrorClasses: EVERY error class the adapter can throw from
 *     `initiateCheck`, for catch routing. A list, not one class: Sterling's
 *     auth/validation/rate-limit/timeout errors each extend `Error` directly
 *     rather than `SterlingApiError`, so a single-class `instanceof` let an
 *     expired credential, a 429 and a timeout fall through as plain Errors —
 *     INTERNAL_SERVER_ERROR, redacted, opaque. Exactly the class of failure the
 *     SERVICE_UNAVAILABLE mapping exists to make legible.
 */
async function initiateProviderCheck(input: {
	orgId: string;
	userId: string;
	actorId: string;
	pii: CandidatePii;
	packageName: string;
	adapter: import('@/server/lib/adapters/background-check/types').BackgroundCheckAdapter;
	accessToken: string;
	provider: 'CHECKR' | 'STERLING';
	apiErrorClasses: ReadonlyArray<new (...args: never[]) => Error>;
	/** The coordinator's FCRA consent attestation. See Guard 0. */
	consentAttested: boolean;
	/**
	 * The real admin behind an impersonated action, or null.
	 *
	 * Load-bearing for `consentAttestedBy`, not decoration. `createTRPCContext`
	 * rewrites `session.user.id` to the impersonated TARGET, so `actorId` — and
	 * with it the attestation column — names the staff member being impersonated,
	 * not the admin who actually ticked the box. Without this, a platform admin
	 * can manufacture evidence that falsely names a coordinator as having sworn
	 * they hold someone's signed FCRA authorization, which defeats the entire
	 * point of the column. Resolve it with `impersonatedBy(ctx)` from
	 * trpc/audit-actor.ts — never `ctx.realUserId` raw, which is set on EVERY
	 * logged-in request.
	 */
	impersonatedBy?: string | null;
}): Promise<{ requestId: string }> {
	const {
		orgId,
		userId,
		actorId,
		pii,
		packageName,
		adapter,
		accessToken,
		provider,
		apiErrorClasses,
		consentAttested,
		impersonatedBy,
	} = input;

	console.log(
		`[bg-check] Initiating check orgId=${orgId} userId=${userId} provider=${provider}`,
	);

	// Guard 0: the caller has attested to holding a signed FCRA authorization.
	//
	// First, and before any query, because it is a fact about the caller's own
	// submission rather than about the target — an unattested request should not
	// cost a database round trip, and refusing here means it never touches the
	// volunteer's row at all.
	//
	// This verifies NOTHING. The platform cannot see a paper form, and saying so
	// plainly is the point: its value is that /terms §4 already assigns this
	// obligation to the org, and until now nothing recorded that anyone had
	// accepted it for a given check. `createBackgroundCheckRequestTx` stamps the
	// attestation onto the row, so a dispute has a named actor and a timestamp.
	//
	// A hand-written message under an allowlisted code, deliberately: as
	// `z.literal(true)` on the router this would arrive as a tRPC-manufactured
	// BAD_REQUEST whose message comes from the Zod cause, which `errorFormatter`
	// redacts to generic copy — the coordinator would be refused with no way to
	// learn why. See domain/error-disclosure.ts.
	if (!consentAttested) {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message:
				"Confirm you have the volunteer's signed background check authorization before running a check.",
		});
	}

	// Guard 1: the volunteer is actually this org's to check.
	//
	// First, and in the shared provider path rather than in each caller, because
	// both public entry points (Checkr and Sterling) reach a paid third-party API
	// that receives the candidate's SSN and date of birth. A guard placed after
	// that call, or in only one of the two callers, is not a guard. The only UI
	// for this is a free-text "Volunteer User ID" field.
	const relationship = await requireOrgVolunteerRelationship(orgId, userId);

	// Guard 1.5: the identity in the PII block is the volunteer just authorized.
	//
	// THE POINT OF THIS GUARD. `userId` and `pii` are two independent free-text
	// fields on the same form, and until this landed nothing checked that they
	// described the same person. The service authorized the `userId`, shipped the
	// TYPED SSN and date of birth to a consumer reporting agency, and bound the
	// resulting report — and the attestation naming a coordinator as holding a
	// signed authorization — to the `userId`. So picking the wrong row sent a
	// STRANGER's SSN to Checkr and filed the result against the volunteer the
	// coordinator meant to check, with nothing on either side to notice.
	//
	// The email is the only submitted field the platform can independently
	// verify, so it carries the whole check: requiring the coordinator to restate
	// the address forces the identity to be stated twice from the same source,
	// and a row mistake makes the two disagree. SSN and DOB remain unverifiable
	// by construction — a mistyped digit still gets through, which is why the
	// name comparison below is also recorded.
	//
	// AFTER the relationship guard, deliberately: run first, this answers "does
	// user X have address Y?" for any `userId` a caller cares to submit, and user
	// ids are not secret (`/v/[userId]` is a public route). Behind Guard 1 the
	// caller has already been proven entitled to this volunteer's record, which
	// the roster and the detail dialog show them anyway, so it discloses nothing
	// new. Still before the paid provider call — the PII must not leave.
	const identity = await findUserIdentity(prisma, userId);

	// Both sides normalized. `User.email` is canonicalized by the T1 database
	// trigger, so this should be a no-op on the stored side — but a raw `===`
	// against an uncanonical legacy row would refuse a legitimate check, and this
	// guard failing CLOSED on a storage detail is the one way it becomes the
	// thing coordinators route around. Plain equality on the normalized values,
	// never Prisma's `mode: 'insensitive'` — see CLAUDE.md.
	const accountEmail = identity?.email;
	if (!accountEmail) {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message:
				'This volunteer has no email address on file, so their identity cannot be confirmed. Ask them to claim their account before running a check.',
		});
	}
	// One canonical form, used BOTH as the thing compared and as the thing sent
	// to the provider — so "the address we verified" and "the address the report
	// is filed under" are the same expression rather than two that happen to
	// agree. It also means a legacy row carrying stray whitespace cannot reach
	// the provider and come back as an opaque 422.
	const candidateEmail = normalizeEmail(accountEmail);
	if (normalizeEmail(pii.email) !== candidateEmail) {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message:
				"The email you entered does not match the address on this volunteer's account. Check you have the right volunteer — the details you submit are sent to the background check provider as this person.",
		});
	}

	// A SIGNAL, not a gate. Legal names and account names legitimately differ
	// (preferred names, marriage, a roster imported from a spreadsheet holding
	// "Bob"), so refusing here would block real checks on real people. It is
	// stamped on the audit row instead, where it is evidence in exactly the
	// dispute this path exists to make reconstructable — and it is the only
	// remaining signal for the case the email cannot catch: the right volunteer
	// named, with another row's name, DOB and SSN typed underneath.
	const nameMismatch = !submittedNameMatchesAccount(
		identity.name,
		pii.firstName,
		pii.lastName,
	);
	if (nameMismatch) {
		// No names in the log line: this is an identity record, and the surface
		// that needs the detail is the audit row, which is access-controlled.
		console.warn(
			`[bg-check] Submitted name does not match the account name orgId=${orgId} userId=${userId}`,
		);
	}

	// Guard 2: no active check already in flight (PENDING or CONSIDER)
	const activeCheck = await findActiveCheckForUserInOrg(userId, orgId);
	if (activeCheck) {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: `A background check is already in progress for this volunteer (status: ${activeCheck.status}).`,
		});
	}

	// Guard 3: no existing VERIFIED BACKGROUND_CHECK credential
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

	// Call provider — OUTSIDE transaction (remote side effect, can't roll back)
	let reportId: string;
	try {
		// The ACCOUNT address goes to the provider, not the typed one. Guard 1.5
		// has just proved the two are the same address, so this changes nothing
		// about which human is described — it means the field the coordinator
		// controls is used only to CONFIRM the identity and never to steer where
		// the provider's candidate correspondence lands. Same rule as the
		// disclosure email resolving its own recipient from `userId`.
		const result = await adapter.initiateCheck(
			{ ...pii, email: candidateEmail },
			packageName,
			accessToken,
		);
		reportId = result.reportId;
	} catch (err) {
		if (apiErrorClasses.some((ErrorClass) => err instanceof ErrorClass)) {
			const apiErr = err as { status?: number; message: string };
			// NEVER log pii fields in error context
			console.error(
				`[bg-check] ${provider} API error status=${apiErr.status ?? 'unknown'}`,
			);
			if (apiErr.status === 422) {
				throw new TRPCError({ code: 'BAD_REQUEST', message: apiErr.message });
			}
			// SERVICE_UNAVAILABLE, not INTERNAL_SERVER_ERROR: this copy is written
			// for the coordinator and its whole value is the word "temporarily" —
			// under an unallowlisted code `errorFormatter` replaces it with generic
			// copy and a transient Checkr/Sterling outage reads as a permanent
			// failure. Found by the T37 review: the sweep audited `throw new Error`
			// and never audited TRPCErrors already carrying a non-allowlisted code.
			throw new TRPCError({
				code: 'SERVICE_UNAVAILABLE',
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
			provider,
			consentAttestedBy: actorId,
		});
		await writeAuditLogTx(tx, {
			orgId,
			actorId,
			action: 'BACKGROUND_CHECK_INITIATED',
			entityType: 'BackgroundCheckRequest',
			entityId: req.id,
			// `relationship` records WHY this check was permitted. During an
			// incident review of a paid check run against the wrong person, the
			// authorizing edge is the first thing you want and the hardest to
			// reconstruct after the fact — a roster row can be soft-deleted.
			// `impersonatedBy` is spread conditionally so a normal request writes no
			// key at all — stamping null on every row makes `queryAuditLog`'s
			// impersonatedOnly filter meaningless (see trpc/audit-actor.ts).
			// `identityNameMismatch` is spread conditionally for the same reason as
			// `impersonatedBy`: a key stamped on every row cannot be filtered on.
			// Present means "the name typed on the form shared no token with the
			// name on the account, and we ran the check anyway" — the one piece of
			// identity doubt the platform can record about a report it cannot
			// otherwise verify.
			metadata: {
				provider,
				externalId: reportId,
				relationship,
				...(impersonatedBy ? { impersonatedBy } : {}),
				...(nameMismatch ? { identityNameMismatch: true } : {}),
			},
		});
		return req;
	});

	console.log(
		`[bg-check] Check initiated requestId=${request.id} externalId=${reportId}`,
	);

	// Tell the subject. Not awaited, AFTER the commit — but NOT a bare `void`.
	//
	// Not awaited, and not allowed to fail the mutation: by this point the paid
	// provider call has already happened, the PII has already left, and the row
	// is committed. Throwing here would report a failure for a check that is
	// genuinely underway and invite the coordinator to run a second one.
	//
	// `waitUntil`, NOT a floating promise. On Vercel the function can be frozen
	// as soon as the tRPC response is written, so a bare `void` promise is
	// racing the freeze — and the thing being dropped is the ONLY disclosure the
	// subject of a background check ever receives. `bulk-import-service.ts:98`
	// already established this for exactly that reason. The `.catch` stays:
	// `waitUntil` keeps the instance alive but does not handle a rejection, and
	// an unhandled one here would be a process-level error for a notice we have
	// deliberately decided is non-fatal.
	//
	// The residual trade-off is still real: a send FAILURE (as opposed to a
	// dropped invocation) loses the witness quietly. `sendEmail` logs and
	// records a SENT EmailEvent, so the absence of one is discoverable after the
	// fact, and a `notifiedAt` column is tracked as a P3 in docs/TODOS.md.
	waitUntil(
		notifyVolunteerOfCheck({ orgId, userId, provider }).catch((err) => {
			console.error(
				`[bg-check] Failed to notify volunteer requestId=${request.id}:`,
				err,
			);
		}),
	);

	return { requestId: request.id };
}

/**
 * Resolve the subject's own address and tell them a check has started.
 *
 * SECURITY: the recipient is resolved from `userId`, NEVER from `pii.email`.
 * The PII block is staff-supplied free text on the initiate form, so a
 * coordinator — careless or otherwise — can type any address there, and sending
 * the notice to it would deliver the one disclosure the subject is entitled to
 * straight back to the party running the check. This is the same rule as
 * `ctx.session.user.email` not being the effective user's address: resolve the
 * address from the id (CLAUDE.md).
 *
 * It re-reads that address rather than accepting the one Guard 1.5 already
 * resolved, and the duplicate query is deliberate. An address PARAMETER here is
 * one wrong argument away from being fed `pii.email` again — the same reason
 * the `email` parameters were deleted from `acceptInvitation` and friends in
 * v0.34.0.0 rather than merely left unused. One extra indexed read on a path
 * that has just made a paid HTTP call to a third party is not a cost worth
 * trading a security invariant for.
 *
 * Silently does nothing if the user has no address on file. Guard 1.5 already
 * refused that case before the provider was called, so from this path the branch
 * survives only for the race where the row changes between the guard and the
 * commit — keep it: the column is nullable and there is no recipient to fall
 * back to. Logged by the caller rather than thrown.
 */
async function notifyVolunteerOfCheck(input: {
	orgId: string;
	userId: string;
	provider: 'CHECKR' | 'STERLING';
}): Promise<void> {
	const [storedEmail, org] = await Promise.all([
		findEmailByUserId(input.userId),
		prisma.organization.findUnique({
			where: { id: input.orgId },
			select: { name: true },
		}),
	]);

	// Canonicalized, exactly as Guard 1.5 canonicalizes the address it hands the
	// provider. Without this the two legs disagree on a legacy padded row: the
	// paid check goes out under the clean address while the volunteer's only
	// disclosure is sent to `' Jane@Example.com'`, which also misses the
	// bounce-suppression lookup in `sendEmail` (it keys on a bare lowercase) and
	// may be rejected by Resend outright. Caught by the Codex adversarial pass.
	const to = storedEmail ? normalizeEmail(storedEmail) : null;

	if (!to || !org) {
		console.error(
			`[bg-check] DISCLOSURE NOT SENT for userId=${input.userId} orgId=${input.orgId}: ${
				to ? 'org not found' : 'no email on file'
			}`,
		);
		return;
	}

	// `sendEmail` returns FALSE rather than throwing — for a Resend error and for
	// a bounce-suppressed address. The `.catch` at the callsite therefore never
	// fires on the most likely failure, so without this check a lost disclosure
	// looks exactly like a delivered one. `console.error`, not `warn`: this is
	// the one notice the subject of a paid background check ever receives, and
	// the absence of it is the thing an incident review is looking for.
	const sent = await sendBackgroundCheckInitiatedEmail({
		to,
		orgName: org.name,
		providerName: PROVIDER_DISPLAY_NAME[input.provider],
	});

	if (!sent) {
		console.error(
			`[bg-check] DISCLOSURE NOT SENT for userId=${input.userId} orgId=${input.orgId}: send failed or address suppressed`,
		);
	}
}

/**
 * The consumer reporting agency's name as a volunteer should read it, not the
 * enum the database holds.
 *
 * A `Record` over the union rather than a ternary, and that is the repo rule
 * rather than a preference: `provider === 'CHECKR' ? 'Checkr' : 'Sterling'`
 * silently labels ANY future provider "Sterling", and this string names the
 * company that received someone's SSN in a legal disclosure. As a Record, a
 * third member of `BackgroundCheckProvider` is a type error here instead —
 * the same shape as `MY_ORG_RELATIONSHIP_COPY` and the `/privacy` provider
 * table (see the derive-from-the-definition rule in CLAUDE.md).
 */
const PROVIDER_DISPLAY_NAME: Record<'CHECKR' | 'STERLING', string> = {
	CHECKR: 'Checkr',
	STERLING: 'Sterling',
};

// ---------------------------------------------------------------------------
// initiateBackgroundCheck (Checkr — public API, called by tRPC)
// ---------------------------------------------------------------------------

export async function initiateBackgroundCheck(input: {
	orgId: string;
	userId: string;
	actorId: string;
	pii: CandidatePii;
	packageName?: string;
	/**
	 * REQUIRED, not defaulted. An optional flag here would fail OPEN at any
	 * callsite that forgot it — the same shape as the `actorRole` parameter
	 * dropped from `inviteMember` in v0.38.6.0, where the default was the hole.
	 */
	consentAttested: boolean;
	/** See `initiateProviderCheck` — required for honest attestation evidence. */
	impersonatedBy?: string | null;
}): Promise<{ requestId: string }> {
	const accessToken = await getOrgCheckrToken(input.orgId);
	if (!accessToken) {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message:
				'This organization has not connected a Checkr account. Go to Settings → Credentials and click "Connect Checkr".',
		});
	}

	return initiateProviderCheck({
		...input,
		packageName:
			input.packageName ??
			(process.env.CHECKR_DEFAULT_PACKAGE || 'tasker_standard'),
		adapter: checkrAdapter,
		accessToken,
		provider: 'CHECKR',
		apiErrorClasses: [CheckrApiError],
	});
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
// Provider-agnostic webhook handler
// ---------------------------------------------------------------------------

/**
 * Shared webhook processing logic for any background check provider.
 *
 * Data flow:
 *   verify signature → parse JSON → extract event ID → idempotency check →
 *   parse actionable payload → find request → skip if terminal →
 *   atomic update (event + credential + status) → CONSIDER email
 *
 * Provider-specific concerns are injected via params:
 *   - adapter: the BackgroundCheckAdapter for signature/payload parsing
 *   - provider: enum value for logs and audit
 *   - badPayloadError: constructor for 400-class errors (caller catches)
 *   - requeueError: constructor for 500-class errors (provider retries)
 */
async function handleProviderWebhookEvent(input: {
	rawBody: Buffer;
	signature: string;
	adapter: import('@/server/lib/adapters/background-check/types').BackgroundCheckAdapter;
	provider: 'CHECKR' | 'STERLING';
	badPayloadError: new (msg: string) => Error;
	requeueError: new (msg: string) => Error;
}): Promise<void> {
	const {
		rawBody,
		signature,
		adapter,
		provider,
		badPayloadError,
		requeueError,
	} = input;

	// Step 1: Verify signature
	adapter.verifyWebhookSignature(rawBody, signature);

	// Step 2: Parse body
	let body: unknown;
	try {
		body = JSON.parse(rawBody.toString('utf-8'));
	} catch {
		throw new badPayloadError('Webhook body is not valid JSON');
	}

	// Extract event ID for idempotency
	const eventId =
		typeof body === 'object' && body !== null
			? ((body as Record<string, unknown>).id as string | undefined)
			: undefined;

	if (!eventId) {
		throw new badPayloadError('Webhook payload missing event id');
	}

	const eventType =
		typeof body === 'object' && body !== null
			? ((body as Record<string, unknown>).type as string | undefined)
			: undefined;

	console.log(
		`[bg-check] ${provider} webhook received eventId=${eventId} type=${eventType ?? 'unknown'}`,
	);

	// Step 3: Idempotency check — early return if already processed
	if (await isCheckrWebhookEventProcessed(eventId)) {
		console.log(
			`[bg-check] ${provider} webhook duplicate — skipping eventId=${eventId}`,
		);
		return;
	}

	// Step 4: Parse actionable payload
	const actionable = adapter.parseActionableWebhookPayload(body);

	if (!actionable) {
		// Non-actionable event type — record for idempotency and return
		await prisma.$transaction(async (tx) => {
			await markCheckrWebhookEventProcessedTx(tx, {
				checkrId: eventId,
				type: eventType ?? 'unknown',
				payload: sanitizeWebhookPayload(body) as Prisma.InputJsonValue,
			});
		});
		return;
	}

	// Step 5: Find the corresponding request by externalId
	const request = await findBackgroundCheckByExternalId(actionable.reportId);
	if (!request) {
		console.warn(
			`[bg-check] ${provider} requeue — unknown externalId=${actionable.reportId}`,
		);
		throw new requeueError(`Unknown reportId: ${actionable.reportId}`);
	}

	// Step 6: Skip if already in a terminal status
	if (isTerminalStatus(request.status)) {
		console.log(
			`[bg-check] ${provider} skipping webhook for terminal request requestId=${request.id} status=${request.status}`,
		);
		await prisma.$transaction(async (tx) => {
			await markCheckrWebhookEventProcessedTx(tx, {
				checkrId: eventId,
				type: eventType ?? 'unknown',
				payload: sanitizeWebhookPayload(body) as Prisma.InputJsonValue,
			});
		});
		return;
	}

	const newStatus = mapResultToStatus(actionable.result);
	const sanitizedPayload = sanitizeWebhookPayload(
		body,
	) as Prisma.InputJsonValue;

	// Step 7: Atomic transaction — record event + update request + optional credential
	let credentialIssued = false;

	await prisma.$transaction(async (tx) => {
		await markCheckrWebhookEventProcessedTx(tx, {
			checkrId: eventId,
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
				provider,
				newStatus,
				wasCredentialIssued: credentialIssued,
				webhookEventId: eventId,
			},
		});
	});

	console.log(
		`[bg-check] ${provider} webhook result requestId=${request.id} status=${newStatus} wasCredentialIssued=${credentialIssued}`,
	);

	// Step 8: Send CONSIDER email — outside transaction, never rethrows
	if (newStatus === 'CONSIDER') {
		try {
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
				`[bg-check] ${provider} email failed requestId=${request.id} error=${String(err)}`,
			);
			// DO NOT rethrow — email failure must not fail the webhook
		}
	}
}

// ---------------------------------------------------------------------------
// handleCheckrWebhookEvent (public API, called by webhook route)
// ---------------------------------------------------------------------------

export async function handleCheckrWebhookEvent(
	rawBody: Buffer,
	signature: string,
): Promise<void> {
	return handleProviderWebhookEvent({
		rawBody,
		signature,
		adapter: checkrAdapter,
		provider: 'CHECKR',
		badPayloadError: CheckrBadPayloadError,
		requeueError: CheckrRequeueError,
	});
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

// ---------------------------------------------------------------------------
// FCRA — issueCredentialAndResolveFcra (atomic review & issue)
// ---------------------------------------------------------------------------

/**
 * Atomically issue a BACKGROUND_CHECK credential AND resolve the FCRA process.
 * Eliminates the partial-success trap where credential issuance succeeds but
 * FCRA resolution fails (or vice versa) when called as two separate mutations.
 */
export async function issueCredentialAndResolveFcra(
	requestId: string,
	orgId: string,
	actorId: string,
	input: {
		notes?: string | null;
		expiresAt?: Date | null;
	},
): Promise<void> {
	const request = await findBackgroundCheckById(requestId);
	if (!request || request.orgId !== orgId) {
		throw new TRPCError({ code: 'NOT_FOUND' });
	}

	if (request.status !== 'CONSIDER') {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: `Cannot issue credential for a check in ${request.status} status.`,
		});
	}

	if (!canResolveFcra(request.fcraStatus)) {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: `Cannot resolve FCRA (status: ${request.fcraStatus}).`,
		});
	}

	await prisma.$transaction(async (tx) => {
		// 1. Issue the BACKGROUND_CHECK credential
		const cred = await upsertCredential(tx, {
			userId: request.userId,
			orgId,
			type: 'BACKGROUND_CHECK',
			status: 'VERIFIED',
			issuedById: actorId,
			notes: input.notes,
			expiresAt: input.expiresAt,
		});

		await writeAuditLogTx(tx, {
			orgId,
			actorId,
			action: 'CREDENTIAL_ISSUED',
			entityType: 'VolunteerCredential',
			entityId: cred.id,
			metadata: {
				userId: request.userId,
				type: 'BACKGROUND_CHECK',
				status: 'VERIFIED',
				backgroundCheckRequestId: requestId,
			},
		});

		// 2. Transition status CONSIDER → COMPLETE + resolve FCRA (CAS guard)
		const { count } = await tx.backgroundCheckRequest.updateMany({
			where: {
				id: requestId,
				status: 'CONSIDER',
				fcraStatus: { in: ['NONE', 'PRE_ADVERSE_SENT'] },
			},
			data: { status: 'COMPLETE', fcraStatus: 'RESOLVED' },
		});
		if (count === 0) {
			throw new TRPCError({
				code: 'CONFLICT',
				message: 'Background check status or FCRA status was already changed.',
			});
		}

		await writeAuditLogTx(tx, {
			orgId,
			actorId,
			action: 'FCRA_RESOLVED',
			entityType: 'BackgroundCheckRequest',
			entityId: requestId,
			metadata: {
				previousFcraStatus: request.fcraStatus,
				credentialId: cred.id,
			},
		});
	});

	// Fire-and-forget: a new VERIFIED credential may unlock a tenure badge.
	void checkAndIssueTenureBadges(request.userId);

	console.log(
		`[bg-check] Credential issued + FCRA resolved requestId=${requestId} userId=${request.userId}`,
	);
}

// ---------------------------------------------------------------------------
// Sterling — connect / disconnect / status
// ---------------------------------------------------------------------------

async function getOrgSterlingKey(orgId: string): Promise<string | null> {
	const org = await prisma.organization.findUnique({
		where: { id: orgId },
		select: { sterlingApiKey: true },
	});
	const raw = org?.sterlingApiKey ?? null;
	if (!raw) return null;
	return tryDecrypt(raw);
}

/**
 * Connect a Sterling account by storing the encrypted API key.
 * Sterling uses API keys (not OAuth) — admin pastes the key in settings.
 */
export async function connectSterlingAccount(
	orgId: string,
	apiKey: string,
	accountId: string,
	actorId: string,
): Promise<void> {
	const encryptedKey = encrypt(apiKey);

	await prisma.$transaction(async (tx) => {
		await tx.organization.update({
			where: { id: orgId },
			data: { sterlingApiKey: encryptedKey, sterlingAccountId: accountId },
		});
		await writeAuditLogTx(tx, {
			orgId,
			actorId,
			action: 'STERLING_CONNECTED',
			entityType: 'Organization',
			entityId: orgId,
			metadata: { accountId },
		});
	});

	console.log(
		`[bg-check] Sterling connected orgId=${orgId} accountId=${accountId}`,
	);
}

export async function disconnectSterlingAccount(
	orgId: string,
	actorId: string,
): Promise<void> {
	await prisma.$transaction(async (tx) => {
		await tx.organization.update({
			where: { id: orgId },
			data: { sterlingApiKey: null, sterlingAccountId: null },
		});
		await writeAuditLogTx(tx, {
			orgId,
			actorId,
			action: 'STERLING_DISCONNECTED',
			entityType: 'Organization',
			entityId: orgId,
			metadata: {},
		});
	});

	console.log(`[bg-check] Sterling disconnected orgId=${orgId}`);
}

export async function getSterlingConnectionStatus(
	orgId: string,
): Promise<{ connected: boolean; accountId: string | null }> {
	const org = await prisma.organization.findUnique({
		where: { id: orgId },
		select: { sterlingApiKey: true, sterlingAccountId: true },
	});
	const connected = !!org?.sterlingApiKey;
	return { connected, accountId: org?.sterlingAccountId ?? null };
}

// ---------------------------------------------------------------------------
// initiateSterlingCheck (public API, called by tRPC)
// ---------------------------------------------------------------------------

export async function initiateSterlingCheck(input: {
	orgId: string;
	userId: string;
	actorId: string;
	pii: CandidatePii;
	packageName?: string;
	/** Required for the same reason as on `initiateBackgroundCheck`. */
	consentAttested: boolean;
	/** See `initiateProviderCheck` — required for honest attestation evidence. */
	impersonatedBy?: string | null;
}): Promise<{ requestId: string }> {
	const apiKey = await getOrgSterlingKey(input.orgId);
	if (!apiKey) {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message:
				'This organization has not connected a Sterling account. Go to Settings → Credentials and enter your Sterling API key.',
		});
	}

	return initiateProviderCheck({
		...input,
		packageName: input.packageName ?? 'standard_criminal',
		adapter: sterlingAdapter,
		accessToken: apiKey,
		provider: 'STERLING',
		apiErrorClasses: [
			SterlingApiError,
			SterlingAuthError,
			SterlingValidationError,
			SterlingRateLimitError,
			SterlingTimeoutError,
		],
	});
}

// ---------------------------------------------------------------------------
// handleSterlingWebhookEvent (public API, called by webhook route)
// ---------------------------------------------------------------------------

/**
 * Sterling requeue error — thrown when we receive a webhook for an unknown
 * reportId. The webhook route returns 500 so Sterling retries.
 */
class SterlingRequeueError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SterlingRequeueError';
	}
}

export async function handleSterlingWebhookEvent(
	rawBody: Buffer,
	signature: string,
): Promise<void> {
	return handleProviderWebhookEvent({
		rawBody,
		signature,
		adapter: sterlingAdapter,
		provider: 'STERLING',
		badPayloadError: SterlingWebhookError,
		requeueError: SterlingRequeueError,
	});
}
