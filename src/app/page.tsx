import Link from 'next/link';
import { Building2, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Home() {
	return (
		<section className="mx-auto max-w-2xl space-y-10 px-4 py-10">
			<div className="space-y-3">
				<p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
					VolunteerReady
				</p>
				<h1 className="text-3xl font-semibold tracking-tight">
					Connect volunteers with the missions that need them most.
				</h1>
				<p className="text-muted-foreground">
					Whether you're volunteering or running a nonprofit, we'll help you get
					started.
				</p>
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				<Card>
					<CardContent className="flex flex-col gap-4 pt-6">
						<ClipboardList className="h-6 w-6 text-muted-foreground" />
						<div className="space-y-1">
							<p className="font-medium">I'm a volunteer</p>
							<p className="text-sm text-muted-foreground">
								Sign in to track the status of your volunteer applications.
							</p>
						</div>
						<Button asChild variant="outline" className="mt-auto w-full">
							<Link href="/login?callbackUrl=/app/my-applications">
								Sign in to track my volunteering
							</Link>
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="flex flex-col gap-4 pt-6">
						<Building2 className="h-6 w-6 text-muted-foreground" />
						<div className="space-y-1">
							<p className="font-medium">I'm setting up an organization</p>
							<p className="text-sm text-muted-foreground">
								Create your organization and start screening volunteers.
							</p>
						</div>
						<Button asChild className="mt-auto w-full">
							<Link href="/login?callbackUrl=/app/onboarding">
								Set up your organization
							</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		</section>
	);
}
