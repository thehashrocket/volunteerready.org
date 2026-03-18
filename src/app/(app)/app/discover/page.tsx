import { Lock } from 'lucide-react';
import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DiscoverClient } from './_components/discover-client';

export const metadata: Metadata = {
	title: 'Discover Volunteers',
	description:
		'Search and invite qualified volunteers to apply to your opportunities.',
};

function ComingSoonCard() {
	return (
		<div className="flex items-center justify-center min-h-[400px]">
			<Card className="max-w-md w-full">
				<CardHeader className="text-center">
					<div className="flex justify-center mb-4">
						<Lock className="h-10 w-10 text-muted-foreground" />
					</div>
					<CardTitle>Volunteer Discovery</CardTitle>
				</CardHeader>
				<CardContent className="text-center text-muted-foreground">
					<p>
						Volunteer search is coming soon. You'll be able to find and invite
						qualified volunteers directly.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}

export default function DiscoverPage() {
	const enabled = process.env.VOLUNTEER_DISCOVERY_ENABLED === 'true';
	if (!enabled) return <ComingSoonCard />;
	return <DiscoverClient />;
}
