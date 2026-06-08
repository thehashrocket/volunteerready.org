import { randomUUID } from 'crypto';
import { prisma } from './prisma-client';

async function main() {
	const user = await prisma.user.findUnique({
		where: { email: 'admin@volunteermatch.local' },
	});
	if (!user) {
		console.log('No admin user found');
		return;
	}
	console.log('User:', user.id, user.email);

	const membership = await prisma.organizationMember.findFirst({
		where: { userId: user.id },
		include: { organization: true },
	});
	console.log(
		'Org:',
		membership?.organization?.id,
		membership?.organization?.name,
	);

	const token = randomUUID();
	const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

	await prisma.session.create({
		data: {
			sessionToken: token,
			userId: user.id,
			expires,
			currentOrgId: membership?.organization?.id || null,
		},
	});

	console.log('SESSION_TOKEN=' + token);
}

main().then(() => prisma.$disconnect());
