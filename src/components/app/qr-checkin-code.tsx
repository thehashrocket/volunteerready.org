'use client';

import { CheckCircle2, WifiOff } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc/client';
import { formatQrData } from '@/server/lib/checkin-token';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const OFFLINE_CACHE_KEY_PREFIX = 'vr-checkin-token-';
const OFFLINE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes (2 windows)

type QrCheckinCodeProps = {
	shiftId: string;
	userId: string;
	shiftStartTime: Date;
	shiftLocation?: string | null;
	qrForegroundColor?: string | null;
};

type Phase = 'before' | 'during' | 'after';

function getPhase(startTime: Date, isCheckedIn: boolean): Phase {
	if (isCheckedIn) return 'after';
	const now = Date.now();
	const start = new Date(startTime).getTime();
	// "During" = within 1 hour before start through end of shift
	if (now >= start - 60 * 60 * 1000) return 'during';
	return 'before';
}

function getContextualCopy(phase: Phase, location?: string | null): string {
	switch (phase) {
		case 'before':
			return location
				? `Show this to staff when you arrive at ${location}.`
				: 'Show this to staff when you arrive.';
		case 'during':
			return "Show this to staff now \u2014 you're checked in when they scan it.";
		case 'after':
			return "You're checked in! Enjoy volunteering.";
	}
}

const DEFAULT_QR_COLOR = '#1B3C2A';

export function QrCheckinCode({
	shiftId,
	userId,
	shiftStartTime,
	shiftLocation,
	qrForegroundColor,
}: QrCheckinCodeProps) {
	const [countdown, setCountdown] = useState(REFRESH_INTERVAL_MS);
	const [isOffline, setIsOffline] = useState(false);
	const [offlineToken, setOfflineToken] = useState<string | null>(null);
	const [offlineExpired, setOfflineExpired] = useState(false);

	// Track online/offline status
	useEffect(() => {
		const goOffline = () => setIsOffline(true);
		const goOnline = () => setIsOffline(false);
		setIsOffline(!navigator.onLine);
		window.addEventListener('offline', goOffline);
		window.addEventListener('online', goOnline);
		return () => {
			window.removeEventListener('offline', goOffline);
			window.removeEventListener('online', goOnline);
		};
	}, []);

	const tokenQuery = trpc.shifts.getCheckinToken.useQuery(
		{ shiftId },
		{
			refetchInterval: REFRESH_INTERVAL_MS,
			staleTime: REFRESH_INTERVAL_MS - 10_000,
		},
	);

	// Cache token to localStorage when online
	useEffect(() => {
		if (tokenQuery.data?.token) {
			const cacheKey = `${OFFLINE_CACHE_KEY_PREFIX}${shiftId}`;
			localStorage.setItem(
				cacheKey,
				JSON.stringify({
					token: tokenQuery.data.token,
					cachedAt: Date.now(),
				}),
			);
		}
	}, [tokenQuery.data?.token, shiftId]);

	// Load cached token when offline
	useEffect(() => {
		if (!isOffline) {
			setOfflineToken(null);
			setOfflineExpired(false);
			return;
		}

		const cacheKey = `${OFFLINE_CACHE_KEY_PREFIX}${shiftId}`;
		const cached = localStorage.getItem(cacheKey);
		if (cached) {
			const { token: cachedToken, cachedAt } = JSON.parse(cached);
			const age = Date.now() - cachedAt;
			if (age < OFFLINE_EXPIRY_MS) {
				setOfflineToken(cachedToken);
				setOfflineExpired(false);
			} else {
				setOfflineToken(cachedToken);
				setOfflineExpired(true);
			}
		}
	}, [isOffline, shiftId]);

	const statusQuery = trpc.shifts.myCheckinStatus.useQuery(
		{ shiftId },
		{
			refetchInterval: 15_000,
			enabled: !!tokenQuery.data,
		},
	);

	const isCheckedIn = statusQuery.data?.status === 'ATTENDED';
	const phase = getPhase(shiftStartTime, isCheckedIn);

	// Countdown timer — dataUpdatedAt intentionally resets countdown on token refresh
	// biome-ignore lint/correctness/useExhaustiveDependencies: dataUpdatedAt resets countdown when token refreshes
	useEffect(() => {
		if (isCheckedIn) return;
		setCountdown(REFRESH_INTERVAL_MS);
		const interval = setInterval(() => {
			setCountdown((prev) => {
				const next = prev - 1000;
				return next <= 0 ? REFRESH_INTERVAL_MS : next;
			});
		}, 1000);
		return () => clearInterval(interval);
	}, [tokenQuery.dataUpdatedAt, isCheckedIn]);

	const formatCountdown = useCallback((ms: number) => {
		const totalSeconds = Math.max(0, Math.floor(ms / 1000));
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}, []);

	if (tokenQuery.isLoading) {
		return (
			<div className="flex h-40 items-center justify-center">
				<div className="h-32 w-32 animate-pulse rounded bg-muted" />
			</div>
		);
	}

	if (tokenQuery.error) {
		return null; // Don't show QR if token generation fails (shift too far away, not confirmed, etc.)
	}

	const token = tokenQuery.data?.token ?? (isOffline ? offlineToken : null);
	if (!token) return null;

	// Checked-in state: show checkmark instead of QR
	if (isCheckedIn) {
		return (
			<div className="flex flex-col items-center gap-2 py-4">
				<div className="flex h-32 w-32 items-center justify-center rounded-lg bg-[#2D7A4F]/10">
					<CheckCircle2 className="h-16 w-16 text-[#2D7A4F]" />
				</div>
				<p className="text-sm font-medium text-[#2D7A4F]">
					{getContextualCopy(phase)}
				</p>
			</div>
		);
	}

	const qrData = formatQrData(shiftId, userId, token);

	return (
		<div className="relative flex flex-col items-center gap-2 py-4">
			{isOffline && (
				<Badge
					variant="outline"
					className="absolute right-0 top-4 text-[#787571]"
				>
					<WifiOff className="mr-1 h-3 w-3" />
					Offline
				</Badge>
			)}
			<div
				role="img"
				aria-label={`Check-in QR code for this shift. ${getContextualCopy(phase)}`}
			>
				<QRCodeSVG
					value={qrData}
					size={160}
					level="M"
					fgColor={qrForegroundColor ?? DEFAULT_QR_COLOR}
					bgColor="transparent"
				/>
			</div>
			<p className="text-center text-sm text-muted-foreground">
				{getContextualCopy(phase, shiftLocation)}
			</p>
			{isOffline && offlineExpired ? (
				<p className="text-xs text-[#B8860B]">
					Token may be expired. Reconnect to refresh.
				</p>
			) : (
				<p
					className="text-xs tabular-nums text-muted-foreground/70"
					aria-live="polite"
				>
					Refreshes in {formatCountdown(countdown)}
				</p>
			)}
		</div>
	);
}
