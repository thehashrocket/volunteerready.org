/**
 * Checkr Partner API — OAuth callback route.
 *
 * Flow:
 *   1. Org admin clicks "Connect Checkr" in the UI
 *   2. Browser redirects to https://partners.checkr.com/authorize/{client_id}?state={orgId}
 *   3. Org staff authenticates with Checkr
 *   4. Checkr redirects here: GET /api/checkr/oauth/callback?code=...&state={orgId}
 *   5. This route exchanges the code for an access_token + account_id
 *   6. Persists checkrAccessToken + checkrAccountId on the Organization
 *   7. Redirects back to /app/settings/background-checks with success or error query param
 *
 * SECURITY:
 *   - The `state` param is the orgId. We validate that the current session's
 *     orgId matches `state` to prevent CSRF / cross-org token injection.
 *   - The access token is stored in the database (server-side only).
 *   - This route requires an active authenticated session with org context.
 */

import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import { IMPERSONATION_COOKIE } from '@/server/domain/impersonation';
import { resolveEffectiveUserId } from '@/server/lib/impersonation-context';
import { connectCheckrAccount } from '@/server/services/backgroundCheckService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const code = searchParams.get('code');
	const state = searchParams.get('state'); // orgId passed as state for CSRF check
	const error = searchParams.get('error');

	const backgroundChecksUrl = '/app/settings/background-checks';

	// Handle Checkr-side errors (e.g. user denied authorization)
	if (error) {
		console.warn(`[checkr-oauth] Authorization denied: ${error}`);
		redirect(`${backgroundChecksUrl}?checkr_error=authorization_denied`);
	}

	if (!code || !state) {
		redirect(`${backgroundChecksUrl}?checkr_error=missing_params`);
	}

	// Validate session — must be authenticated with an org context. Resolved
	// through impersonation so an admin acting as a target user connects the
	// target's org, not their own.
	const session = await getServerSession(authOptions);
	const realUserId = session?.user?.id ?? null;
	const cookieValue = req.cookies.get(IMPERSONATION_COOKIE)?.value ?? null;
	const {
		effectiveUserId: userId,
		isImpersonating,
		impersonatedBy,
	} = await resolveEffectiveUserId(realUserId, cookieValue);
	if (!userId) {
		redirect(
			`/auth/signin?callbackUrl=${encodeURIComponent(backgroundChecksUrl)}`,
		);
	}

	// CSRF check: state must match the effective user's orgId.
	// (The tRPC getCheckrOAuthUrl procedure embeds orgId as state)
	// We look up the org from DB via the service layer via prisma directly here
	// since this is a Next.js route handler (not tRPC)
	const { prisma } = await import('@/server/repositories/prisma');

	let sessionOrgId: string | null;
	if (isImpersonating) {
		// No session token for the target user under impersonation — resolve
		// their first org membership directly, same as app/layout.tsx.
		const firstMembership = await prisma.organizationMember.findFirst({
			where: { userId },
			select: { organizationId: true },
			orderBy: { createdAt: 'asc' },
		});
		sessionOrgId = firstMembership?.organizationId ?? null;
	} else {
		const dbSession = await prisma.session.findFirst({
			where: { userId },
			orderBy: { expires: 'desc' },
			select: { currentOrgId: true },
		});
		sessionOrgId = dbSession?.currentOrgId ?? null;
	}

	if (!sessionOrgId || sessionOrgId !== state) {
		console.error(
			`[checkr-oauth] State mismatch: expected orgId=${sessionOrgId} got state=${state}`,
		);
		redirect(`${backgroundChecksUrl}?checkr_error=state_mismatch`);
	}

	// The success redirect must live OUTSIDE the try: next/navigation's
	// redirect() throws NEXT_REDIRECT, and a catch around it would swallow
	// the success and re-redirect to the error state.
	try {
		await connectCheckrAccount(sessionOrgId, code, userId, impersonatedBy);
	} catch (err) {
		console.error('[checkr-oauth] Token exchange failed', err);
		redirect(`${backgroundChecksUrl}?checkr_error=token_exchange_failed`);
	}
	redirect(`${backgroundChecksUrl}?checkr_connected=true`);
}
