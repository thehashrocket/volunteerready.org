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
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import { connectCheckrAccount } from '@/server/services/backgroundCheckService';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
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

	// Validate session — must be authenticated with an org context
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		redirect(
			`/auth/signin?callbackUrl=${encodeURIComponent(backgroundChecksUrl)}`,
		);
	}

	// CSRF check: state must match the session's orgId
	// (The tRPC getCheckrOAuthUrl procedure embeds orgId as state)
	// We look up the session's org from DB via the service layer via prisma directly here
	// since this is a Next.js route handler (not tRPC)
	const { prisma } = await import('@/server/repositories/prisma');
	const dbSession = await prisma.session.findFirst({
		where: { userId: session.user.id },
		orderBy: { expires: 'desc' },
		select: { currentOrgId: true },
	});

	const sessionOrgId = dbSession?.currentOrgId;
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
		await connectCheckrAccount(sessionOrgId, code, session.user.id);
	} catch (err) {
		console.error('[checkr-oauth] Token exchange failed', err);
		redirect(`${backgroundChecksUrl}?checkr_error=token_exchange_failed`);
	}
	redirect(`${backgroundChecksUrl}?checkr_connected=true`);
}
