'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { safeErrorMessage } from '@/components/app/query-error-card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { trpc } from '@/lib/trpc/client';

/**
 * Org-level on/off for the volunteer roster: staff adding volunteers and
 * assigning them to shifts. On by default. Turning it off hides those staff
 * surfaces; volunteers can still pick open shifts themselves.
 *
 * `router.refresh()` after a change, because the sidebar's Volunteers link and
 * the shift dialog's assign picker are gated server-side on the same flag.
 */
export function VolunteerRosterToggle({
	initialEnabled,
	canEdit,
}: {
	initialEnabled: boolean;
	canEdit: boolean;
}) {
	const router = useRouter();
	const [enabled, setEnabled] = useState(initialEnabled);
	const save = trpc.org.setVolunteerRoster.useMutation({
		onSuccess: (data) => {
			toast.success(
				data.enabled
					? 'Volunteer roster turned on.'
					: 'Volunteer roster turned off.',
			);
			router.refresh();
		},
		onError: (err, vars) => {
			setEnabled(!vars.enabled);
			toast.error(safeErrorMessage(err) ?? "We couldn't save that. Try again.");
		},
	});

	return (
		<div className="flex items-start justify-between gap-6">
			<div className="space-y-1">
				<Label htmlFor="volunteer-roster" className="text-sm font-medium">
					Volunteer roster and scheduling
				</Label>
				<p className="text-sm text-muted-foreground">
					Let staff add volunteers to your roster and put them on shifts.
					Volunteers can always sign themselves up for open shifts.
				</p>
				{!canEdit && (
					<p className="text-sm text-muted-foreground">
						Only owners and admins can change this.
					</p>
				)}
			</div>
			<Switch
				id="volunteer-roster"
				checked={enabled}
				disabled={!canEdit || save.isPending}
				onCheckedChange={(next) => {
					setEnabled(next);
					save.mutate({ enabled: next });
				}}
			/>
		</div>
	);
}
