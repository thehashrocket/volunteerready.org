'use client';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Link from 'next/link';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';

// Fix Leaflet's default marker icons broken by webpack asset hashing
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)
	._getIconUrl;
L.Icon.Default.mergeOptions({
	iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
	iconRetinaUrl:
		'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
	shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

type PinGroup = {
	lat: number;
	lng: number;
	orgName: string;
	orgSlug: string;
	location: string | null;
	opportunities: {
		id: string;
		title: string;
		tags: { id: string; name: string }[];
	}[];
};

type Props = {
	pins: PinGroup[];
	center: [number, number];
	zoom: number;
	onPinClick?: (key: string) => void;
};

export function LeafletMap({ pins, center, zoom }: Props) {
	return (
		<MapContainer
			center={center}
			zoom={zoom}
			className="h-full w-full"
			scrollWheelZoom
		>
			<TileLayer
				attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
				url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
			/>
			{pins.map((pin) => (
				<Marker key={`${pin.lat},${pin.lng}`} position={[pin.lat, pin.lng]}>
					<Popup>
						<div className="min-w-[200px] space-y-1.5">
							<p className="font-semibold text-foreground">{pin.orgName}</p>
							{pin.location && (
								<p className="text-xs text-muted-foreground">{pin.location}</p>
							)}
							<p className="text-xs text-muted-foreground">
								{pin.opportunities.length}{' '}
								{pin.opportunities.length === 1
									? 'opportunity'
									: 'opportunities'}
							</p>
							{pin.opportunities
								.flatMap((o) => o.tags)
								.filter(
									(t, i, arr) =>
										t.name && arr.findIndex((x) => x.name === t.name) === i,
								)
								.slice(0, 5)
								.map((tag) => (
									<span
										key={tag.id}
										className="mr-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
									>
										{tag.name}
									</span>
								))}
							<div className="pt-1">
								<Link
									href={`/opportunities/${pin.orgSlug}`}
									className="text-xs font-medium text-primary hover:underline"
								>
									View opportunities &rarr;
								</Link>
							</div>
						</div>
					</Popup>
				</Marker>
			))}
		</MapContainer>
	);
}
