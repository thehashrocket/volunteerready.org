/**
 * CLI escape hatch: grant or revoke platform admin by email.
 *
 * Usage:
 *   pnpm admin:grant <email>
 *   pnpm admin:revoke <email>
 *
 * Never get locked out of your own platform.
 */
import { PrismaClient } from '../src/prisma/generated/client';

const prisma = new PrismaClient();

async function main() {
	const args = process.argv.slice(2);
	const scriptName = process.argv[1]?.split('/').pop() ?? '';
	const isRevoke = scriptName.includes('revoke') || args.includes('--revoke');

	const email = args.find((a) => !a.startsWith('--'));
	if (!email) {
		console.error('Usage: pnpm admin:grant <email>');
		console.error('       pnpm admin:revoke <email>');
		process.exit(1);
	}

	const user = await prisma.user.findUnique({
		where: { email },
		select: { id: true, email: true, isPlatformAdmin: true },
	});

	if (!user) {
		console.error(`❌ No user found with email: ${email}`);
		process.exit(1);
	}

	if (isRevoke) {
		if (!user.isPlatformAdmin) {
			console.log(`${user.email} is not a platform admin. No change.`);
			return;
		}
		await prisma.$transaction(async (tx) => {
			await tx.user.update({
				where: { id: user.id },
				data: { isPlatformAdmin: false },
			});
			await tx.auditLog.create({
				data: {
					actorId: null,
					action: 'PLATFORM_ADMIN_REVOKED',
					entityType: 'User',
					entityId: user.id,
					metadata: { email: user.email, source: 'cli' },
				},
			});
		});
		console.log(`✅ Revoked platform admin from ${user.email}`);
	} else {
		if (user.isPlatformAdmin) {
			console.log(`${user.email} is already a platform admin. No change.`);
			return;
		}
		await prisma.$transaction(async (tx) => {
			await tx.user.update({
				where: { id: user.id },
				data: { isPlatformAdmin: true },
			});
			await tx.auditLog.create({
				data: {
					actorId: null,
					action: 'PLATFORM_ADMIN_GRANTED',
					entityType: 'User',
					entityId: user.id,
					metadata: { email: user.email, source: 'cli' },
				},
			});
		});
		console.log(`✅ Granted platform admin to ${user.email}`);
	}
}

main()
	.catch((err) => {
		console.error('Failed:', err);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
