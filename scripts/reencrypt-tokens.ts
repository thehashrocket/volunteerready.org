/**
 * Re-encrypt all Checkr OAuth tokens with the current primary encryption key.
 *
 * Used during key rotation (Step 3 of the 5-step sequence):
 *   1. Set CHECKR_TOKEN_ENCRYPTION_KEY_NEW with the new key
 *   2. Deploy — decrypt falls back to _NEW key for old tokens
 *   3. Run this script — re-encrypts all tokens with the NEW key
 *   4. Swap: move _NEW value into primary, remove _NEW
 *   5. Deploy — single-key mode again
 *
 * The script is idempotent — safe to run multiple times. Tokens already
 * encrypted with the primary key will be re-encrypted (new IV each time).
 *
 * Usage: pnpm reencrypt-tokens
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../src/prisma/generated/client';
import { reEncrypt, tryDecrypt } from '../src/server/lib/crypto';

const datasourceUrl = process.env.DATABASE_URL;
if (!datasourceUrl) {
	throw new Error('DATABASE_URL is not set. Create a .env or .env.local file.');
}

const prisma = new PrismaClient({
	adapter: new PrismaPg(new Pool({ connectionString: datasourceUrl })),
});

async function main() {
	const orgs = await prisma.organization.findMany({
		where: { checkrAccessToken: { not: null } },
		select: { id: true, name: true, checkrAccessToken: true },
	});

	console.log(
		`[reencrypt] Found ${orgs.length} org(s) with Checkr tokens to re-encrypt.`,
	);

	let updated = 0;
	let skipped = 0;
	let errors = 0;

	for (const org of orgs) {
		const token = org.checkrAccessToken;
		if (!token) {
			skipped++;
			continue;
		}

		try {
			// tryDecrypt handles both encrypted and legacy plaintext tokens
			const plaintext = tryDecrypt(token);

			// Re-encrypt with current primary key
			const reEncrypted = reEncrypt(token);
			if (!reEncrypted) {
				skipped++;
				continue;
			}

			await prisma.organization.update({
				where: { id: org.id },
				data: { checkrAccessToken: reEncrypted },
			});

			updated++;
			console.log(`  [ok] ${org.name} (${org.id})`);
		} catch (err) {
			errors++;
			console.error(
				`  [ERROR] ${org.name} (${org.id}): ${err instanceof Error ? err.message : err}`,
			);
		}
	}

	console.log(
		`[reencrypt] Done. Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`,
	);

	if (errors > 0) {
		console.error(
			'[reencrypt] WARNING: Some tokens failed to re-encrypt. Investigate before completing key rotation.',
		);
		process.exit(1);
	}
}

main()
	.catch((err) => {
		console.error('[reencrypt] Fatal error:', err);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
