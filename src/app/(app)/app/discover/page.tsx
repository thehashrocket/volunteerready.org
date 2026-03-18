import type { Metadata } from 'next';
import { DiscoverClient } from './_components/discover-client';

export const metadata: Metadata = {
	title: 'Discover Volunteers',
	description:
		'Search and invite qualified volunteers to apply to your opportunities.',
};

export default function DiscoverPage() {
	return <DiscoverClient />;
}
