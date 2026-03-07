import Link from 'next/link';
import { Building2, ClipboardList } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function WelcomePage() {
	return (
		<div className="mx-auto max-w-xl space-y-8">
			<PageHeader
				title="Welcome to VolunteerReady"
				description="Tell us how you're using the platform."
			/>

			<div className="grid gap-4">
				<Card>
					<CardContent className="flex items-start gap-4 pt-6">
						<ClipboardList className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
						<div className="min-w-0 flex-1 space-y-1">
							<p className="font-medium">I'm a volunteer</p>
							<p className="text-sm text-muted-foreground">
								Track the status of your volunteer applications.
							</p>
						</div>
						<Button asChild variant="outline" className="shrink-0">
							<Link href="/app/my-applications">View my applications</Link>
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="flex items-start gap-4 pt-6">
						<Building2 className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
						<div className="min-w-0 flex-1 space-y-1">
							<p className="font-medium">I'm setting up an organization</p>
							<p className="text-sm text-muted-foreground">
								Create your organization and start screening volunteers.
							</p>
						</div>
						<Button asChild className="shrink-0">
							<Link href="/app/onboarding">Set up organization</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
