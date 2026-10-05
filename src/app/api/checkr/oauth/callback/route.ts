/**
 * Checkr Partner API — OAuth callback route.
 *
 * Flow:
 *   1. Org admin clicks "Connect Checkr" in the UI
 *   2. Browser redirects to https://partners.checkr.com/authorize/{client_id}?state={signed state}
 *   3. Org staff authenticates with Checkr
 *   4. Checkr redirects here: GET /api/checkr/oauth/callback?code=...&state={signed state}
 *   5. This route exchanges the code for an access_token + account_id
 *   6. Persists checkrAccessToken + checkrAccountId on the Organization
 *   7. Redirects back to /app/settings/background-checks with success or error query param
 *
 * SECURITY:
 *   - `state` is signed for the browser session that started the flow and the
 *     org it was started for (checkr-oauth-state.ts). The callback refuses a
 *     state it did not issue to this session, or one that has expired.
 *   - The org comes from a membership (the session's resolved org context, or
 *     the impersonated user's oldest membership), and connecting needs ADMIN+,
 *     the same as `getCheckrOAuthUrl` (adminProcedure).
 *   - The access token is stored in the database (server-side only).
 *   - This route requires an active authenticated session with org context.
 */

import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Role } from '@/prisma/generated/client';
import { authOptions } from '@/server/auth';
import { IMPERSONATION_COOKIE } from '@/server/domain/impersonation';
import { roleRank } from '@/server/domain/permissions';
import { verifyCheckrOAuthState } from '@/server/lib/checkr-oauth-state';
import { resolveEffectiveUserId } from '@/server/lib/impersonation-context';
import { connectCheckrAccount } from '@/server/services/backgroundCheckService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const code = searchParams.get('code');
	const state = searchParams.get('state'); // signed by getCheckrOAuthUrl
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
		// The OAuth code cannot be reused, so the user restarts the connect.
		redirect('/login');
	}

	// CSRF check: the state must have been issued to this browser session, and
	// for the org this user acts in.
	// The session callback exposes only a token whose session row belongs to
	// the signed-in user; it is the token getCheckrOAuthUrl signed with.
	const sessionToken =
		(session as { sessionToken?: string | null } | null)?.sessionToken ?? null;
	let stateOrgId: string | null = null;
	try {
		stateOrgId = sessionToken
			? verifyCheckrOAuthState({ state, sessionToken })
			: null;
	} catch (err) {
		// Only a missing NEXTAUTH_SECRET throws here; fail closed.
		console.error('[checkr-oauth] Could not verify state', err);
	}

	let sessionOrgId: string | null;
	let role: Role | null;
	if (isImpersonating) {
		// No session token for the target user under impersonation — resolve
		// their first org membership directly, same as app/layout.tsx.
		const { prisma } = await import('@/server/repositories/prisma');
		const firstMembership = await prisma.organizationMember.findFirst({
			where: { userId },
			select: { organizationId: true, role: true },
			orderBy: { createdAt: 'asc' },
		});
		sessionOrgId = firstMembership?.organizationId ?? null;
		role = firstMembership?.role ?? null;
	} else {
		// The session callback resolves this request's org context from the
		// user's memberships (resolveOrgContext), with the matching role.
		const ext = session as { orgId?: string | null; role?: Role | null };
		sessionOrgId = ext.orgId ?? null;
		role = ext.role ?? null;
	}

	if (!sessionOrgId || !stateOrgId || sessionOrgId !== stateOrgId) {
		console.error(
			`[checkr-oauth] State mismatch: expected orgId=${sessionOrgId} got state for orgId=${stateOrgId}`,
		);
		redirect(`${backgroundChecksUrl}?checkr_error=state_mismatch`);
	}

	if (!role || roleRank[role] < roleRank.ADMIN) {
		redirect(`${backgroundChecksUrl}?checkr_error=not_authorized`);
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
