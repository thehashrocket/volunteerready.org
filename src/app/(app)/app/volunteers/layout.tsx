import { redirect } from 'next/navigation';
import { resolveVolunteerRosterFlag } from '@/server/lib/roster-flag';

/**
 * Route guard for the volunteer roster.
 *
 * The sidebar already hides the nav item when the flag is off, but that is
 * cosmetic — anyone can type the URL. This closes the route independently, so
 * "is the feature off?" has exactly one answer regardless of how you arrived.
 *
 * Fails CLOSED: if impersonation resolution failed, or no org resolves, or the
 * flag is off, redirect. `resolveVolunteerRosterFlag` collapses all three into
 * `enabled: false` — see its SECURITY note for why the impersonation check has
 * to run before the effective user is derived.
 */
export default async function VolunteersLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { enabled } = await resolveVolunteerRosterFlag();
	if (!enabled) redirect('/app');

	return <>{children}</>;
}
