'use client';

import type { Html5Qrcode as Html5QrcodeType } from 'html5-qrcode';
import {
	Calendar,
	Camera,
	CheckCircle2,
	Clock,
	MapPin,
	Search,
	Users,
	XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { trpc } from '@/lib/trpc/client';
import { parseQrData } from '@/server/lib/checkin-token';

type ScanResult = {
	type: 'success' | 'already' | 'error';
	message: string;
	volunteerName?: string;
};

export default function Scanner() {
	const [selectedShiftId, setSelectedShiftId] = useState<string>('');
	const [, setIsScanning] = useState(false);
	const [cameraError, setCameraError] = useState<string | null>(null);
	const [lastResult, setLastResult] = useState<ScanResult | null>(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [showCompletion, setShowCompletion] = useState(false);
	const scannerRef = useRef<Html5QrcodeType | null>(null);
	const processingRef = useRef(false);

	// Fetch today's shifts for this org
	const shiftsQuery = trpc.shifts.list.useQuery({
		status: undefined,
	});

	// Filter to shifts within ±2h
	const todayShifts = (shiftsQuery.data ?? []).filter((shift) => {
		const now = Date.now();
		const start = new Date(shift.startTime).getTime();
		const diffHours = Math.abs(start - now) / (1000 * 60 * 60);
		return (
			diffHours <= 2 && (shift.status === 'OPEN' || shift.status === 'FULL')
		);
	});

	// Auto-select nearest shift
	useEffect(() => {
		if (!selectedShiftId && todayShifts.length > 0) {
			const now = Date.now();
			const nearest = todayShifts.reduce((prev, curr) => {
				const prevDiff = Math.abs(new Date(prev.startTime).getTime() - now);
				const currDiff = Math.abs(new Date(curr.startTime).getTime() - now);
				return currDiff < prevDiff ? curr : prev;
			});
			setSelectedShiftId(nearest.id);
		}
	}, [todayShifts, selectedShiftId]);

	const selectedShift = todayShifts.find((s) => s.id === selectedShiftId);

	// Check-in stats (poll every 10s)
	const statsQuery = trpc.shifts.getCheckinStats.useQuery(
		{ shiftId: selectedShiftId },
		{
			enabled: !!selectedShiftId,
			refetchInterval: 10_000,
		},
	);

	// Signups for search-by-name fallback
	const signupsQuery = trpc.shifts.getSignups.useQuery(
		{ shiftId: selectedShiftId },
		{ enabled: !!selectedShiftId },
	);

	const checkinMut = trpc.shifts.checkinByQr.useMutation();
	const manualCheckinMut = trpc.shifts.markAttendance.useMutation();

	// Completion detection
	useEffect(() => {
		if (statsQuery.data) {
			const { attended, total } = statsQuery.data;
			if (total > 0 && attended >= total) {
				setShowCompletion(true);
			}
		}
	}, [statsQuery.data]);

	// Haptic feedback
	const triggerHaptic = useCallback(() => {
		if (navigator.vibrate) {
			navigator.vibrate(50);
		}
	}, []);

	// Handle QR scan result
	const handleScan = useCallback(
		async (decodedText: string) => {
			if (processingRef.current) return;
			processingRef.current = true;

			try {
				const parsed = parseQrData(decodedText);
				if (!parsed || parsed.version !== 1) {
					setLastResult({
						type: 'error',
						message: 'Not a valid check-in code.',
					});
					return;
				}

				if (parsed.shiftId !== selectedShiftId) {
					setLastResult({
						type: 'error',
						message: 'QR code is for a different shift.',
					});
					return;
				}

				const result = await checkinMut.mutateAsync({
					shiftId: parsed.shiftId,
					userId: parsed.userId,
					token: parsed.token,
				});

				// Find volunteer name from signups
				const volunteer = signupsQuery.data?.find(
					(s) => s.userId === parsed.userId,
				);
				const name = volunteer?.user?.name ?? 'Volunteer';

				triggerHaptic();

				if (result.alreadyCheckedIn) {
					setLastResult({
						type: 'already',
						message: `${name} is already checked in.`,
						volunteerName: name,
					});
				} else {
					setLastResult({
						type: 'success',
						message: `${name} checked in!`,
						volunteerName: name,
					});
					// Refresh stats
					statsQuery.refetch();
					signupsQuery.refetch();
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Check-in failed.';
				setLastResult({ type: 'error', message });
			} finally {
				setTimeout(() => {
					processingRef.current = false;
				}, 1500);
			}
		},
		[
			selectedShiftId,
			checkinMut,
			signupsQuery.data,
			triggerHaptic,
			statsQuery,
			signupsQuery,
		],
	);

	// Start/stop camera — lazy import html5-qrcode to avoid module-level DOM access
	useEffect(() => {
		if (!selectedShiftId || showCompletion) return;
		if (!document.getElementById('qr-reader')) return;

		let scanner: Html5QrcodeType | null = null;
		let cancelled = false;

		import('html5-qrcode')
			.then(({ Html5Qrcode }) => {
				if (cancelled) return;
				try {
					scanner = new Html5Qrcode('qr-reader');
				} catch {
					setCameraError('Could not initialize scanner.');
					return;
				}
				scannerRef.current = scanner;
				setIsScanning(true);
				setCameraError(null);

				scanner
					.start(
						{ facingMode: 'environment' },
						{ fps: 10, qrbox: { width: 250, height: 250 } },
						(text) => handleScan(text),
						() => {},
					)
					.catch((err) => {
						setIsScanning(false);
						if (String(err).includes('NotAllowedError')) {
							setCameraError(
								'Camera access denied. Please allow camera access in your browser settings.',
							);
						} else if (String(err).includes('NotFoundError')) {
							setCameraError('No camera found on this device.');
						} else {
							setCameraError('Could not start camera. Please try again.');
						}
					});
			})
			.catch(() => {
				setCameraError('Could not load scanner library.');
			});

		return () => {
			cancelled = true;
			if (scanner?.isScanning) {
				scanner.stop().catch(() => {});
			}
		};
	}, [selectedShiftId, handleScan, showCompletion]);

	// Search-by-name handler
	const handleManualCheckin = useCallback(
		async (userId: string, name: string) => {
			try {
				await manualCheckinMut.mutateAsync({
					shiftId: selectedShiftId,
					userId,
					status: 'ATTENDED',
				});
				triggerHaptic();
				setLastResult({
					type: 'success',
					message: `${name} checked in!`,
					volunteerName: name,
				});
				setSearchQuery('');
				statsQuery.refetch();
				signupsQuery.refetch();
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Check-in failed.';
				setLastResult({ type: 'error', message });
			}
		},
		[
			selectedShiftId,
			manualCheckinMut,
			triggerHaptic,
			statsQuery,
			signupsQuery,
		],
	);

	// Filtered signups for search
	const filteredSignups = (signupsQuery.data ?? []).filter((s) => {
		if (!searchQuery) return false;
		const name = s.user?.name?.toLowerCase() ?? '';
		return name.includes(searchQuery.toLowerCase()) && s.status === 'CONFIRMED';
	});

	const searchInputRef = useRef<HTMLInputElement>(null);

	// Keyboard shortcuts: / or Cmd+K focuses search, Esc re-focuses camera
	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if (
				e.target instanceof HTMLInputElement ||
				e.target instanceof HTMLTextAreaElement
			) {
				if (e.key === 'Escape') {
					(e.target as HTMLElement).blur();
					e.preventDefault();
				}
				return;
			}

			if (e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) {
				e.preventDefault();
				searchInputRef.current?.focus();
			}
		}
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, []);


	// No shifts available
	if (shiftsQuery.isLoading) {
		return (
			<div className="text-sm text-muted-foreground">Loading shifts...</div>
		);
	}

	if (todayShifts.length === 0) {
		return (
			<Card>
				<CardContent className="py-8 text-center">
					<Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
					<p className="text-sm text-muted-foreground">
						No shifts within the next 2 hours. The scanner is available when
						shifts are active.
					</p>
				</CardContent>
			</Card>
		);
	}

	// Completion summary
	if (showCompletion && statsQuery.data) {
		const { attended, total } = statsQuery.data;
		const noShows = total - attended;
		return (
			<div className="space-y-4">
				<Card className="border-[#2D7A4F]/30 bg-[#2D7A4F]/5">
					<CardHeader>
						<CardTitle className="font-display text-xl text-[#2D7A4F]">
							Check-in Complete
						</CardTitle>
						<CardDescription>{selectedShift?.title}</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="flex items-center gap-2 text-lg font-semibold">
							<CheckCircle2 className="h-5 w-5 text-[#2D7A4F]" />
							{attended} volunteers checked in
						</div>
						{noShows > 0 && (
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<XCircle className="h-4 w-4" />
								{noShows} not yet checked in
							</div>
						)}
						<Button variant="outline" onClick={() => setShowCompletion(false)}>
							Keep Scanning
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Shift selector */}
			{todayShifts.length > 1 && (
				<Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
					<SelectTrigger className="w-full max-w-sm">
						<SelectValue placeholder="Select a shift" />
					</SelectTrigger>
					<SelectContent>
						{todayShifts.map((shift) => (
							<SelectItem key={shift.id} value={shift.id}>
								{shift.title} —{' '}
								{new Date(shift.startTime).toLocaleTimeString([], {
									hour: '2-digit',
									minute: '2-digit',
								})}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			)}

			{/* Stats bar */}
			{statsQuery.data && (
				<div className="flex items-center gap-3">
					<Users className="h-4 w-4 text-muted-foreground" />
					<span className="text-sm font-medium">
						{statsQuery.data.attended}/{statsQuery.data.total} checked in
					</span>
					<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-[#1B3C2A] transition-all duration-300"
							style={{ width: `${statsQuery.data.rate}%` }}
						/>
					</div>
					<span className="text-xs text-muted-foreground">
						{statsQuery.data.rate}%
					</span>
				</div>
			)}

			{/* Camera viewfinder */}
			{cameraError ? (
				<Card className="border-destructive/30">
					<CardContent className="py-8 text-center">
						<Camera className="mx-auto mb-3 h-10 w-10 text-destructive" />
						<p className="text-sm text-destructive">{cameraError}</p>
						<p className="mt-2 text-xs text-muted-foreground">
							Check your browser settings to allow camera access.
						</p>
					</CardContent>
				</Card>
			) : (
				<div id="qr-reader" className="w-full overflow-hidden rounded-lg" />
			)}

			{/* Inline result card */}
			{lastResult && (
				<div
					className={`rounded-lg p-4 transition-colors duration-200 ${
						lastResult.type === 'success'
							? 'bg-[#2D7A4F]/10'
							: lastResult.type === 'already'
								? 'bg-[#2D7A4F]/5'
								: 'bg-[#B8860B]/10'
					}`}
					aria-live="assertive"
				>
					<div className="flex items-center gap-3">
						{lastResult.type === 'success' ? (
							<CheckCircle2 className="h-6 w-6 shrink-0 text-[#2D7A4F]" />
						) : lastResult.type === 'already' ? (
							<CheckCircle2 className="h-6 w-6 shrink-0 text-[#2D7A4F]/60" />
						) : (
							<XCircle className="h-6 w-6 shrink-0 text-[#B8860B]" />
						)}
						<div>
							{lastResult.volunteerName && (
								<p className="font-display text-lg font-semibold">
									{lastResult.volunteerName}
								</p>
							)}
							<p className="text-sm text-muted-foreground">
								{lastResult.message}
							</p>
						</div>
						{lastResult.type === 'already' && (
							<Badge variant="outline" className="ml-auto">
								Already checked in
							</Badge>
						)}
					</div>
				</div>
			)}

			{/* Shift context (before first scan) */}
			{!lastResult && selectedShift && (
				<Card>
					<CardContent className="py-4">
						<div className="space-y-2">
							<p className="font-medium">{selectedShift.title}</p>
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<Clock className="h-3.5 w-3.5" />
								{new Date(selectedShift.startTime).toLocaleTimeString([], {
									hour: '2-digit',
									minute: '2-digit',
								})}{' '}
								–{' '}
								{new Date(selectedShift.endTime).toLocaleTimeString([], {
									hour: '2-digit',
									minute: '2-digit',
								})}
							</div>
							{selectedShift.location && (
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<MapPin className="h-3.5 w-3.5" />
									{selectedShift.location}
								</div>
							)}
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<Users className="h-3.5 w-3.5" />
								{selectedShift._count?.signups ?? 0} confirmed signups
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Search-by-name fallback */}
			<div className="space-y-2">
				<div className="relative">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						ref={searchInputRef}
						placeholder="Or search by name... (press / to focus)"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-9"
						aria-label="Search volunteers by name to check in manually"
					/>
				</div>
				{filteredSignups.length > 0 && (
					<div className="rounded-lg border">
						{filteredSignups.map((signup) => (
							<button
								type="button"
								key={signup.id}
								className="flex w-full items-center justify-between p-3 text-left hover:bg-muted/50"
								onClick={() =>
									handleManualCheckin(
										signup.userId,
										signup.user?.name ?? 'Volunteer',
									)
								}
							>
								<span className="text-sm font-medium">
									{signup.user?.name ?? 'Unknown'}
								</span>
								<Badge variant="outline" className="text-xs">
									Check in
								</Badge>
							</button>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
