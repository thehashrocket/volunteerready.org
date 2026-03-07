import Link from 'next/link';
import { Briefcase, ClipboardList, FileText, Plus, Rocket, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';

export default function DashboardPage() {
	return (
		<div className="space-y-8">
			<PageHeader
				title="Dashboard"
				description="Track activity across your organization."
				actions={
					<Button size="sm" asChild>
						<Link href="/app/opportunities">
							<Plus className="mr-2 h-4 w-4" />
							New opportunity
						</Link>
					</Button>
				}
			/>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardContent className="flex items-start gap-4 pt-6">
						<ClipboardList className="mt-1 h-5 w-5 text-muted-foreground" />
						<div className="flex-1 space-y-1">
							<p className="font-medium">Screener questions</p>
							<p className="text-sm text-muted-foreground">
								Configure the questions shown on your volunteer application form.
							</p>
						</div>
						<Button asChild variant="outline" size="sm">
							<Link href="/app/screener">Manage</Link>
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="flex items-start gap-4 pt-6">
						<FileText className="mt-1 h-5 w-5 text-muted-foreground" />
						<div className="flex-1 space-y-1">
							<p className="font-medium">Volunteer applications</p>
							<p className="text-sm text-muted-foreground">
								Review and act on incoming volunteer applications.
							</p>
						</div>
						<Button asChild variant="outline" size="sm">
							<Link href="/app/applications">Review</Link>
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="flex items-start gap-4 pt-6">
						<Users className="mt-1 h-5 w-5 text-muted-foreground" />
						<div className="flex-1 space-y-1">
							<p className="font-medium">Team members</p>
							<p className="text-sm text-muted-foreground">
								Manage your organization's members and invite new ones.
							</p>
						</div>
						<Button asChild variant="outline" size="sm">
							<Link href="/app/settings/team">Manage</Link>
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="flex items-start gap-4 pt-6">
						<Briefcase className="mt-1 h-5 w-5 text-muted-foreground" />
						<div className="flex-1 space-y-1">
							<p className="font-medium">Opportunities</p>
							<p className="text-sm text-muted-foreground">
								Create and publish volunteer opportunities for your organization.
							</p>
						</div>
						<Button asChild variant="outline" size="sm">
							<Link href="/app/opportunities">Manage</Link>
						</Button>
					</CardContent>
				</Card>
			</div>

			<EmptyState
				title="No activity yet"
				description="Once volunteers start applying, you will see updates here."
				icon={Rocket}
				action={
					<Button asChild variant="outline">
						<Link href="/app/settings/team">Invite teammates</Link>
					</Button>
				}
			/>
		</div>
	);
}
