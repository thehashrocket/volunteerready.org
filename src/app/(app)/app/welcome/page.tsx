import { Building2, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function WelcomePage() {
	return (
		<div className="mx-auto max-w-xl space-y-10 py-4">
			<div className="space-y-2">
				<p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
					Getting started
				</p>
				<h1 className="font-display text-3xl font-bold text-foreground">
					Welcome to VolunteerReady
				</h1>
				<p className="text-muted-foreground">
					How will you be using the platform today?
				</p>
			</div>

			<div className="grid gap-4">
				<Card className="relative overflow-hidden border-border/70 transition-shadow hover:shadow-md">
					<div className="absolute inset-y-0 left-0 w-1 bg-success" />
					<CardContent className="flex items-start gap-4 pb-6 pl-8 pt-6">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/15">
							<ClipboardList className="h-5 w-5 text-success-foreground" />
						</div>
						<div className="min-w-0 flex-1 space-y-1">
							<p className="font-semibold text-foreground">I'm a volunteer</p>
							<p className="text-sm text-muted-foreground">
								Track the status of your volunteer applications and find new
								opportunities.
							</p>
						</div>
						<Button asChild variant="outline" className="shrink-0 rounded-lg">
							<Link href="/app/my-applications">View my applications</Link>
						</Button>
					</CardContent>
				</Card>

				<Card className="relative overflow-hidden border-primary/30 bg-primary/5 transition-shadow hover:shadow-md">
					<div className="absolute inset-y-0 left-0 w-1 bg-primary" />
					<CardContent className="flex items-start gap-4 pb-6 pl-8 pt-6">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
							<Building2 className="h-5 w-5 text-primary" />
						</div>
						<div className="min-w-0 flex-1 space-y-1">
							<p className="font-semibold text-foreground">
								I'm setting up an organization
							</p>
							<p className="text-sm text-muted-foreground">
								Create your organization and start recruiting and screening
								volunteers.
							</p>
						</div>
						<Button asChild className="shrink-0 rounded-lg">
							<Link href="/app/onboarding">Set up organization</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
