/**
 * Re-encrypt all encrypted tokens/keys with the current primary encryption key.
 *
 * Covers: Checkr OAuth tokens AND Sterling API keys (both use AES-256-GCM).
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

async function reEncryptField(
	org: { id: string; name: string },
	fieldName: string,
	value: string | null,
): Promise<'updated' | 'skipped' | 'error'> {
	if (!value) return 'skipped';

	try {
		const reEncrypted = reEncrypt(value);
		if (!reEncrypted) return 'skipped';

		await prisma.organization.update({
			where: { id: org.id },
			data: { [fieldName]: reEncrypted },
		});

		console.log(`  [ok] ${org.name} (${org.id}) — ${fieldName}`);
		return 'updated';
	} catch (err) {
		console.error(
			`  [ERROR] ${org.name} (${org.id}) — ${fieldName}: ${err instanceof Error ? err.message : err}`,
		);
		return 'error';
	}
}

async function main() {
	const orgs = await prisma.organization.findMany({
		where: {
			OR: [
				{ checkrAccessToken: { not: null } },
				{ sterlingApiKey: { not: null } },
			],
		},
		select: {
			id: true,
			name: true,
			checkrAccessToken: true,
			sterlingApiKey: true,
		},
	});

	console.log(
		`[reencrypt] Found ${orgs.length} org(s) with encrypted tokens/keys to re-encrypt.`,
	);

	let updated = 0;
	let skipped = 0;
	let errors = 0;

	for (const org of orgs) {
		for (const [field, value] of [
			['checkrAccessToken', org.checkrAccessToken],
			['sterlingApiKey', org.sterlingApiKey],
		] as const) {
			const result = await reEncryptField(org, field, value);
			if (result === 'updated') updated++;
			else if (result === 'skipped') skipped++;
			else errors++;
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
