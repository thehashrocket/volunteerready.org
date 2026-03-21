import { withCronAuth } from '@/server/lib/cron-auth';
import { sendOrgFeedbackEmails } from '@/server/services/org-feedback-service';

export const GET = withCronAuth('org-feedback', async () => {
	const result = await sendOrgFeedbackEmails();
	return { ok: true, ...result };
});
