import { withCronAuth } from '@/server/lib/cron-auth';
import { sendShiftReminders } from '@/server/services/shift-reminder-service';

export const GET = withCronAuth('shift-reminders', async () => {
	const result = await sendShiftReminders();
	return { ok: true, ...result };
});
