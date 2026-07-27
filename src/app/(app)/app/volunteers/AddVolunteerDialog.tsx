'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { safeErrorMessage } from '@/components/app/query-error-card';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trpc } from '@/lib/trpc/client';
import { DISPLAY_NAME_MAX } from '@/server/domain/org-volunteer';

/**
 * Add a volunteer to the roster.
 *
 * The three add branches produce only TWO distinct messages. Minting a shadow
 * user and linking an UNCLAIMED user another org already created must read
 * IDENTICALLY — a different message for the latter would tell the coordinator
 * that some other organisation already has this person on their roster, which
 * is cross-org membership disclosure. Security §7 accepted account enumeration
 * between "unknown" and "existing"; it never accepted this.
 *
 * The service enforces the same rule (see INDISTINGUISHABLE_OUTCOMES); this is
 * the second half of it, at the surface the coordinator actually reads.
 */
export function AddVolunteerDialog({ onAdded }: { onAdded: () => void }) {
	const [open, setOpen] = useState(false);
	const [displayName, setDisplayName] = useState('');
	const [email, setEmail] = useState('');
	const [phone, setPhone] = useState('');
	const [fieldError, setFieldError] = useState<string | null>(null);

	const addVolunteer = trpc.volunteers.add.useMutation({
		onSuccess: (result) => {
			// `notified` is the ONLY thing the server tells us about which branch
			// ran. The three internal outcomes are deliberately collapsed to two
			// server-side (see toClientResult) so the response body cannot leak
			// that another org already had this person.
			toast.success(
				result.notified
					? `${result.displayName} added to your roster. We let them know by email.`
					: `${result.displayName} added to your roster.`,
			);
			setDisplayName('');
			setEmail('');
			setPhone('');
			setFieldError(null);
			onAdded();
			setOpen(false);
		},
		onError: (error) => {
			// "Already on your roster" is a no-op, not a failure — rendered inline
			// rather than as an error toast, which would train coordinators to
			// dismiss real errors.
			//
			// safeErrorMessage allowlists client-safe tRPC codes (CONFLICT included)
			// and swallows internal ones, so an unexpected Prisma message can't be
			// rendered verbatim to the user. Matches volunteers/page.tsx.
			setFieldError(safeErrorMessage(error) ?? 'Could not add that volunteer.');
		},
	});

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setFieldError(null);
		addVolunteer.mutate({
			displayName,
			email,
			phone: phone.trim() ? phone : null,
		});
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) setFieldError(null);
			}}
		>
			<DialogTrigger asChild>
				<Button>
					<Plus className="mr-2 h-4 w-4" />
					Add volunteer
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add a volunteer</DialogTitle>
					<DialogDescription>
						They don&apos;t need to sign up first. You can schedule them and
						track their hours right away.
					</DialogDescription>
				</DialogHeader>

				<form className="space-y-4" onSubmit={handleSubmit}>
					<div className="space-y-2">
						<Label htmlFor="volunteer-name">Name</Label>
						<Input
							id="volunteer-name"
							value={displayName}
							maxLength={DISPLAY_NAME_MAX}
							onChange={(e) => setDisplayName(e.target.value)}
							required
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="volunteer-email">Email</Label>
						<Input
							id="volunteer-email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
						/>
						{/* The coordinator is about to cause mail to be sent to a third
						    party on their org's behalf. They should know before they
						    submit, not after the reply arrives. */}
						<p className="text-xs text-muted-foreground">
							If they already use VolunteerReady, we&apos;ll let them know you
							added them.
						</p>
					</div>

					<div className="space-y-2">
						<Label htmlFor="volunteer-phone">Phone (optional)</Label>
						<Input
							id="volunteer-phone"
							value={phone}
							onChange={(e) => setPhone(e.target.value)}
						/>
					</div>

					{fieldError ? (
						<p className="text-sm text-destructive">{fieldError}</p>
					) : null}

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setOpen(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={addVolunteer.isPending}>
							{addVolunteer.isPending ? 'Adding…' : 'Add volunteer'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
