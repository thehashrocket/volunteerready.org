'use client';

import { MapPin } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc/client';
import { isWithinRadius } from '@/server/lib/geo';

const GEO_RADIUS_METERS = 100;

type GeoCheckinProps = {
	shiftId: string;
	shiftLatitude: number;
	shiftLongitude: number;
};

type GeoState =
	| 'watching'
	| 'checking-in'
	| 'checked-in'
	| 'denied'
	| 'unavailable';

export function GeoCheckin({
	shiftId,
	shiftLatitude,
	shiftLongitude,
}: GeoCheckinProps) {
	const [geoState, setGeoState] = useState<GeoState>('watching');
	const watchIdRef = useRef<number | null>(null);
	const checkedInRef = useRef(false);

	const tokenQuery = trpc.shifts.getCheckinToken.useQuery(
		{ shiftId },
		{ enabled: geoState === 'watching' },
	);

	const selfCheckinMut = trpc.shifts.selfCheckin.useMutation();

	const handleCheckin = useCallback(
		async (token: string) => {
			if (checkedInRef.current) return;
			checkedInRef.current = true;
			setGeoState('checking-in');

			try {
				await selfCheckinMut.mutateAsync({ shiftId, token });
				setGeoState('checked-in');
			} catch {
				// Reset so they can try again
				checkedInRef.current = false;
				setGeoState('watching');
			}
		},
		[shiftId, selfCheckinMut],
	);

	useEffect(() => {
		if (!('geolocation' in navigator)) {
			setGeoState('unavailable');
			return;
		}

		const watchId = navigator.geolocation.watchPosition(
			(position) => {
				const { latitude, longitude } = position.coords;
				const within = isWithinRadius(
					latitude,
					longitude,
					shiftLatitude,
					shiftLongitude,
					GEO_RADIUS_METERS,
				);

				if (within && tokenQuery.data?.token && !checkedInRef.current) {
					handleCheckin(tokenQuery.data.token);
				}
			},
			(error) => {
				if (error.code === error.PERMISSION_DENIED) {
					setGeoState('denied');
				} else {
					setGeoState('unavailable');
				}
			},
			{
				enableHighAccuracy: true,
				maximumAge: 10_000,
				timeout: 15_000,
			},
		);

		watchIdRef.current = watchId;
		return () => navigator.geolocation.clearWatch(watchId);
	}, [shiftLatitude, shiftLongitude, tokenQuery.data?.token, handleCheckin]);

	if (geoState === 'unavailable') return null;

	if (geoState === 'denied') {
		return (
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<MapPin className="h-3.5 w-3.5" />
				<span>Enable location in Settings for auto check-in.</span>
			</div>
		);
	}

	if (geoState === 'checked-in') {
		return (
			<Badge variant="default" className="bg-[#2D7A4F]">
				Auto-checked in
			</Badge>
		);
	}

	if (geoState === 'checking-in') {
		return (
			<Badge variant="outline" className="text-[#2A6496]">
				Checking in...
			</Badge>
		);
	}

	return (
		<Badge variant="outline" className="text-[#2A6496]">
			<MapPin className="mr-1 h-3 w-3" />
			Auto check-in enabled
		</Badge>
	);
}
