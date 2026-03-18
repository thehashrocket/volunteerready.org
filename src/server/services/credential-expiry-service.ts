import { writeAuditLogTx } from '../repositories/auditRepo';
import {
	findExpiredCredentials,
	findExpiredShareTokens,
	markCredentialExpiredTx,
} from '../repositories/credential-expiry-repo';
import { markTokenExpiredTx } from '../repositories/credentialShareTokenRepo';
import { prisma } from '../repositories/prisma';

export async function expireStaleCredentialsAndTokens(): Promise<{
	credentialsExpired: number;
	tokensExpired: number;
}> {
	let credentialsExpired = 0;
	let tokensExpired = 0;

	// --- Expire stale credentials ---
	const expiredCredentials = await findExpiredCredentials();

	for (const cred of expiredCredentials) {
		try {
			await prisma.$transaction(async (tx) => {
				await markCredentialExpiredTx(tx, cred.id);
				await writeAuditLogTx(tx, {
					orgId: cred.orgId,
					actorId: null,
					action: 'CREDENTIAL_AUTO_EXPIRED',
					entityType: 'VolunteerCredential',
					entityId: cred.id,
					metadata: { userId: cred.userId, type: cred.type },
				});
			});
			credentialsExpired++;
		} catch (e) {
			// P2025 = record not found (concurrent modification) — skip and continue
			if ((e as { code?: string }).code === 'P2025') {
				console.warn(
					`[cron] Credential ${cred.id} already modified — skipping`,
				);
			} else {
				console.error(`[cron] Failed to expire credential ${cred.id}`, e);
			}
		}
	}

	// --- Expire stale share tokens ---
	const expiredTokens = await findExpiredShareTokens();

	for (const token of expiredTokens) {
		try {
			await prisma.$transaction(async (tx) => {
				await markTokenExpiredTx(tx, token.id);
				await writeAuditLogTx(tx, {
					actorId: null,
					action: 'SHARE_TOKEN_AUTO_EXPIRED',
					entityType: 'CredentialShareToken',
					entityId: token.id,
				});
			});
			tokensExpired++;
		} catch (e) {
			if ((e as { code?: string }).code === 'P2025') {
				console.warn(
					`[cron] Share token ${token.id} already modified — skipping`,
				);
			} else {
				console.error(`[cron] Failed to expire share token ${token.id}`, e);
			}
		}
	}

	return { credentialsExpired, tokensExpired };
}
