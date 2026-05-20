'use client';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';

// Fix Leaflet's default marker icons broken by webpack asset hashing
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)
	._getIconUrl;
L.Icon.Default.mergeOptions({
	iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
	iconRetinaUrl:
		'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
	shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

type Props = {
	lat: number;
	lng: number;
	location?: string | null;
};

export function OpportunityLocationMap({ lat, lng, location }: Props) {
	return (
		<div className="mb-4">
			<div className="h-[200px] w-full overflow-hidden rounded-md border">
				<MapContainer
					center={[lat, lng]}
					zoom={14}
					className="h-full w-full"
					zoomControl={false}
					dragging={false}
					scrollWheelZoom={false}
					doubleClickZoom={false}
					keyboard={false}
					attributionControl={false}
				>
					<TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
					<Marker position={[lat, lng]} />
				</MapContainer>
			</div>
			{location && (
				<p className="mt-1.5 text-xs text-muted-foreground">{location}</p>
			)}
		</div>
	);
}
