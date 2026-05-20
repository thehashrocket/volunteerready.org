'use client';

import { MapPin, Navigation, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { trackEvent } from '@/lib/analytics';
import { haversineDistance } from '@/lib/geo';
import type { listForMap } from '@/server/repositories/publicOpportunityRepo';

const LeafletMap = dynamic(
	() => import('./LeafletMap').then((m) => m.LeafletMap),
	{
		ssr: false,
		loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
	},
);

type Opportunity = Awaited<ReturnType<typeof listForMap>>[number];

type PinGroup = {
	key: string;
	lat: number;
	lng: number;
	orgName: string;
	orgSlug: string;
	location: string | null;
	opportunities: Opportunity[];
};

const DEFAULT_CENTER: [number, number] = [39.5, -98.35];
const DEFAULT_ZOOM = 4;

function coordKey(lat: number, lng: number): string {
	return `${Math.round(lat * 10000) / 10000},${Math.round(lng * 10000) / 10000}`;
}

function groupByCoord(opportunities: Opportunity[]): PinGroup[] {
	const groups = new Map<string, PinGroup>();
	for (const opp of opportunities) {
		if (opp.lat == null || opp.lng == null) continue;
		const key = coordKey(opp.lat, opp.lng);
		if (!groups.has(key)) {
			groups.set(key, {
				key,
				lat: opp.lat,
				lng: opp.lng,
				orgName: opp.organization.name,
				orgSlug: opp.organization.slug,
				location: opp.location,
				opportunities: [],
			});
		}
		groups.get(key)?.opportunities.push(opp);
	}
	return Array.from(groups.values());
}

type UserLocation = { lat: number; lng: number };

export function MapView({ opportunities }: { opportunities: Opportunity[] }) {
	const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
	const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
	const [locationError, setLocationError] = useState(false);
	const [locationLoading, setLocationLoading] = useState(false);
	const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_CENTER);
	const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);

	useEffect(() => {
		trackEvent('map_view');
	}, []);

	const allTags = useMemo(() => {
		const seen = new Set<string>();
		for (const opp of opportunities) {
			for (const tag of opp.tags) {
				if (tag.name) seen.add(tag.name);
			}
		}
		return Array.from(seen).sort();
	}, [opportunities]);

	const filtered = useMemo(() => {
		if (selectedTags.size === 0) return opportunities;
		return opportunities.filter((opp) =>
			opp.tags.some((t) => selectedTags.has(t.name)),
		);
	}, [opportunities, selectedTags]);

	const pins = useMemo(() => groupByCoord(filtered), [filtered]);

	const sortedList = useMemo(() => {
		if (!userLocation) return pins;
		return [...pins].sort(
			(a, b) =>
				haversineDistance(userLocation.lat, userLocation.lng, a.lat, a.lng) -
				haversineDistance(userLocation.lat, userLocation.lng, b.lat, b.lng),
		);
	}, [pins, userLocation]);

	function handleUseLocation() {
		if (!navigator.geolocation) {
			setLocationError(true);
			return;
		}
		setLocationLoading(true);
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
				setUserLocation(loc);
				setMapCenter([loc.lat, loc.lng]);
				setMapZoom(11);
				setLocationLoading(false);
				trackEvent('map_location_used');
			},
			() => {
				setLocationError(true);
				setLocationLoading(false);
			},
		);
	}

	function toggleTag(tag: string) {
		setSelectedTags((prev) => {
			const next = new Set(prev);
			if (next.has(tag)) {
				next.delete(tag);
			} else {
				next.add(tag);
				trackEvent('map_tag_filter', { tag });
			}
			return next;
		});
	}

	return (
		<div className="flex h-full flex-col">
			{/* Filter toolbar */}
			<div className="flex flex-wrap items-center gap-2 border-b bg-background px-4 py-3">
				{allTags.length > 0 && (
					<>
						<span className="text-xs font-medium text-muted-foreground">
							Filter:
						</span>
						{allTags.map((tag) => (
							<Button
								key={tag}
								type="button"
								variant={selectedTags.has(tag) ? 'default' : 'outline'}
								size="sm"
								className="h-7 rounded-full px-3 text-xs"
								onClick={() => toggleTag(tag)}
							>
								{tag}
								{selectedTags.has(tag) && <X className="ml-1 h-3 w-3" />}
							</Button>
						))}
						{selectedTags.size > 0 && (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-7 text-xs"
								onClick={() => setSelectedTags(new Set())}
							>
								Clear
							</Button>
						)}
					</>
				)}
				<div className="ml-auto">
					{locationError ? (
						<span className="text-xs text-muted-foreground">
							Location unavailable
						</span>
					) : (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-7 gap-1.5 text-xs"
							onClick={handleUseLocation}
							disabled={locationLoading || !!userLocation}
						>
							<Navigation className="h-3 w-3" />
							{userLocation
								? 'Location active'
								: locationLoading
									? 'Locating…'
									: 'Use my location'}
						</Button>
					)}
				</div>
			</div>

			{/* Map + list */}
			<div className="flex flex-1 overflow-hidden">
				{/* Map */}
				<div className="flex-1">
					<LeafletMap pins={pins} center={mapCenter} zoom={mapZoom} />
				</div>

				{/* List panel */}
				<div className="hidden w-80 flex-col overflow-y-auto border-l bg-background lg:flex">
					<div className="border-b px-4 py-3">
						<p className="text-sm font-medium text-foreground">
							{pins.length === 0
								? 'No locations found'
								: `${pins.length} location${pins.length === 1 ? '' : 's'}`}
							{filtered.length !== opportunities.length && (
								<span className="ml-1 text-muted-foreground">
									({filtered.length} of {opportunities.length} opportunities)
								</span>
							)}
						</p>
					</div>
					<div className="divide-y">
						{sortedList.map((pin) => {
							const distanceMeters = userLocation
								? haversineDistance(
										userLocation.lat,
										userLocation.lng,
										pin.lat,
										pin.lng,
									)
								: null;
							const distanceMi =
								distanceMeters != null
									? (distanceMeters / 1609.34).toFixed(1)
									: null;

							const uniqueTags = pin.opportunities
								.flatMap((o) => o.tags)
								.filter(
									(t, i, arr) =>
										t.name && arr.findIndex((x) => x.name === t.name) === i,
								)
								.slice(0, 3);

							return (
								<Link
									key={pin.key}
									href={`/opportunities/${pin.orgSlug}`}
									onClick={() =>
										trackEvent('map_list_click', { org: pin.orgSlug })
									}
									className="block px-4 py-3 transition-colors hover:bg-muted/50"
								>
									<div className="flex items-start justify-between gap-2">
										<p className="text-sm font-medium text-foreground leading-tight">
											{pin.orgName}
										</p>
										{distanceMi && (
											<span className="shrink-0 text-xs text-muted-foreground">
												{distanceMi} mi
											</span>
										)}
									</div>
									{pin.location && (
										<p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
											<MapPin className="h-3 w-3 shrink-0" />
											{pin.location}
										</p>
									)}
									<p className="mt-1 text-xs text-muted-foreground">
										{pin.opportunities.length}{' '}
										{pin.opportunities.length === 1
											? 'opportunity'
											: 'opportunities'}
									</p>
									{uniqueTags.length > 0 && (
										<div className="mt-1.5 flex flex-wrap gap-1">
											{uniqueTags.map((tag) => (
												<Badge
													key={tag.id}
													variant="neutral"
													className="text-[10px]"
												>
													{tag.name}
												</Badge>
											))}
										</div>
									)}
								</Link>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}
