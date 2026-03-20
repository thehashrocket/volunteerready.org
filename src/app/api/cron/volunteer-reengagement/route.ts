import { withCronAuth } from '@/server/lib/cron-auth';
import { sendReengagementEmails } from '@/server/services/reengagement-service';

export const GET = withCronAuth('volunteer-reengagement', async () => {
	const result = await sendReengagementEmails();
	return { ok: true, ...result };
});
