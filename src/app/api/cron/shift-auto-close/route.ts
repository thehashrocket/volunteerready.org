import { withCronAuth } from '@/server/lib/cron-auth';
import { autoCloseExpiredShifts } from '@/server/services/shift-auto-close-service';

export const GET = withCronAuth('shift-auto-close', async () => {
	const result = await autoCloseExpiredShifts();
	return { ok: true, ...result };
});
