import { resolveVolunteerRosterFlag } from '@/server/lib/roster-flag';
import { ShiftsClient } from './ShiftsClient';

/**
 * Server boundary for /app/shifts.
 *
 * The page itself is a client component and always has been; this wrapper
 * exists only to resolve `staff_created_volunteers` on the server and hand it
 * down. There is no client read path for feature flags, and adding one would
 * flash the assign picker in after hydration and then remove it for a
 * non-pilot org — which T16's verify step explicitly forbids.
 *
 * Unlike `/app/volunteers` this route is NOT closed when the flag is off. Shifts
 * are a core feature for every org; only the two roster-dependent surfaces
 * inside `ShiftDetailDialog` are withheld.
 */
export default async function ShiftsPage() {
	const { enabled } = await resolveVolunteerRosterFlag();

	return <ShiftsClient hasVolunteerRoster={enabled} />;
}
