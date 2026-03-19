import { withCronAuth } from '@/server/lib/cron-auth';
import { sendDigestEmails } from '@/server/services/digest-service';

export const GET = withCronAuth('email-digests', async () => {
	const result = await sendDigestEmails();
	return { ok: true, ...result };
});
