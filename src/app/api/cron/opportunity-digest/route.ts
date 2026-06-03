import { withCronAuth } from '@/server/lib/cron-auth';
import { sendOpportunityDigestEmails } from '@/server/services/opportunityDigestService';

export const GET = withCronAuth('opportunity-digest', async () => {
	let totalEmailsSent = 0;
	let totalUsersProcessed = 0;
	let cursor: string | null = null;

	// Loop until all eligible users are processed in this run
	do {
		const result = await sendOpportunityDigestEmails({ cursor });
		totalEmailsSent += result.emailsSent;
		totalUsersProcessed += result.usersProcessed;
		cursor = result.nextCursor;
	} while (cursor !== null);

	return {
		ok: true,
		emailsSent: totalEmailsSent,
		usersProcessed: totalUsersProcessed,
	};
});
