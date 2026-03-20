'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, MapPin, Search } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { GeoCheckin } from '@/components/app/geo-checkin';
import { InstallPrompt } from '@/components/app/install-prompt';
import { QrCheckinCode } from '@/components/app/qr-checkin-code';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc/client';

function isWithin24Hours(startTime: Date | string): boolean {
	const start = new Date(startTime).getTime();
	const now = Date.now();
	const hoursUntil = (start - now) / (1000 * 60 * 60);
	return hoursUntil <= 24;
}

export default function MyShiftsPage() {
	const session = useSession();
	const userId = session.data?.user?.id;
	const qc = useQueryClient();
	const { data: signups, isLoading } =
		trpc.shifts.myUpcomingWithWaitlist.useQuery();

	const cancelMut = trpc.shifts.cancelSignup.useMutation({
		onSuccess: () => {
			toast.success('Signup cancelled');
			qc.invalidateQueries();
		},
		onError: (err) => toast.error(err.message),
	});

	return (
		<div className="space-y-6">
			<PageHeader
				title="My Shifts"
				description="Your upcoming volunteer shift signups."
			/>

			<InstallPrompt />

			{isLoading ? (
				<Card>
					<CardContent className="space-y-2 pt-6">
						{Array.from({ length: 3 }).map((_, i) => (
							<Skeleton key={i} className="h-28 w-full" />
						))}
					</CardContent>
				</Card>
			) : !signups?.length ? (
				<EmptyState
					icon={Search}
					title="No upcoming shifts"
					description="Browse opportunities to find shifts to sign up for."
					action={
						<Button asChild>
							<Link href="/app/browse-opportunities">Browse Opportunities</Link>
						</Button>
					}
				/>
			) : (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{signups.map((signup) => (
						<Card key={signup.id}>
							<CardHeader className="pb-3">
								<CardTitle className="text-base">
									{signup.shift.title}
								</CardTitle>
								<CardDescription>
									{signup.shift.organization.name}
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<Calendar className="h-4 w-4" />
									{new Date(signup.shift.startTime).toLocaleDateString(
										undefined,
										{
											weekday: 'short',
											month: 'short',
											day: 'numeric',
										},
									)}
								</div>
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<Clock className="h-4 w-4" />
									{new Date(signup.shift.startTime).toLocaleTimeString([], {
										hour: '2-digit',
										minute: '2-digit',
									})}{' '}
									–{' '}
									{new Date(signup.shift.endTime).toLocaleTimeString([], {
										hour: '2-digit',
										minute: '2-digit',
									})}
								</div>
								{signup.shift.location && (
									<div className="flex items-center gap-2 text-sm text-muted-foreground">
										<MapPin className="h-4 w-4" />
										{signup.shift.location}
									</div>
								)}
								{signup.shift.isRemote && (
									<Badge variant="outline">Remote</Badge>
								)}
								{signup.status === 'WAITLISTED' && (
									<Badge variant="warning">Waitlisted</Badge>
								)}
								{signup.status === 'CONFIRMED' &&
									userId &&
									isWithin24Hours(signup.shift.startTime) && (
										<>
											<QrCheckinCode
												shiftId={signup.shift.id}
												userId={userId}
												shiftStartTime={new Date(signup.shift.startTime)}
												shiftLocation={signup.shift.location}
											/>
											{signup.shift.latitude != null &&
												signup.shift.longitude != null && (
													<GeoCheckin
														shiftId={signup.shift.id}
														shiftLatitude={signup.shift.latitude}
														shiftLongitude={signup.shift.longitude}
													/>
												)}
										</>
									)}
								<Button
									variant="outline"
									size="sm"
									className="w-full"
									onClick={() => cancelMut.mutate({ shiftId: signup.shift.id })}
								>
									{signup.status === 'WAITLISTED'
										? 'Leave Waitlist'
										: 'Cancel Signup'}
								</Button>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
