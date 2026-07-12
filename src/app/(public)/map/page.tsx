import type { Metadata } from 'next';
import { listForMap } from '@/server/repositories/publicOpportunityRepo';
import { MapView } from './MapView';

export const metadata: Metadata = {
	title: 'Volunteer Opportunities Map | VolunteerReady',
	description:
		'Find volunteer opportunities near you. Browse published openings on an interactive map, filter by type, and use your location to sort by distance.',
};

export default async function MapPage() {
	const opportunities = await listForMap();

	return (
		<div className="flex h-[calc(100vh-3.5rem)] flex-col">
			<MapView opportunities={opportunities} />
		</div>
	);
}
