/**
 * OG Share Card — /api/share-card/[userId]
 *
 * Generates a social share image for a volunteer's public profile.
 * Returns a generic fallback for non-PUBLIC or not-found profiles.
 *
 * Design: forest green (#1B3C2A) header, sand (#C4A882) stat boxes,
 * warm neutral (#FAFAF8) background. Fraunces bold for display text.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { getPublicProfile } from '@/server/services/volunteerIdentityService';

export const runtime = 'nodejs';

// Cache for 1 hour — score can change but not frequently.
export const revalidate = 3600;

function loadFont(filename: string): Buffer {
	return readFileSync(join(process.cwd(), 'public', 'fonts', filename));
}

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ userId: string }> },
) {
	const { userId } = await params;
	const profile = await getPublicProfile(userId);

	// Load Fraunces bold for display text (critical — without this OG image looks generic)
	const frauncesBold = loadFont('fraunces-bold.ttf');
	const geistRegular = loadFont('geist-regular.ttf');
	const geistSemibold = loadFont('geist-semibold.ttf');

	const fonts = [
		{ name: 'Fraunces', data: frauncesBold, weight: 700 as const },
		{ name: 'Geist', data: geistRegular, weight: 400 as const },
		{ name: 'Geist', data: geistSemibold, weight: 600 as const },
	];

	// Fallback card for non-PUBLIC or not-found profiles — no PII exposed.
	if (!profile) {
		return new ImageResponse(
			<div
				style={{
					width: '100%',
					height: '100%',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					background: '#FAFAF8',
					fontFamily: 'Geist',
				}}
			>
				<div
					style={{
						color: '#A8A5A0',
						fontSize: 20,
						fontFamily: 'Fraunces',
						fontWeight: 700,
					}}
				>
					VolunteerReady
				</div>
			</div>,
			{ width: 1200, height: 630, fonts },
		);
	}

	const location = [profile.city, profile.state].filter(Boolean).join(', ');
	const credCount = profile.credentials.length;

	return new ImageResponse(
		<div
			style={{
				width: '100%',
				height: '100%',
				display: 'flex',
				flexDirection: 'column',
				background: '#FAFAF8',
				fontFamily: 'Geist',
			}}
		>
			{/* Header band */}
			<div
				style={{
					background: '#1B3C2A',
					padding: '40px 60px',
					display: 'flex',
					flexDirection: 'column',
					gap: 8,
				}}
			>
				<div
					style={{
						fontFamily: 'Fraunces',
						fontWeight: 700,
						fontSize: 48,
						color: '#FAFAF8',
						lineHeight: 1.15,
					}}
				>
					{profile.displayName}
				</div>
				{location && (
					<div style={{ fontSize: 18, color: '#C4A882' }}>{location}</div>
				)}
				<div
					style={{
						marginTop: 4,
						fontSize: 14,
						color: 'rgba(250,250,248,0.6)',
						fontWeight: 600,
						letterSpacing: '0.08em',
						textTransform: 'uppercase',
					}}
				>
					Verified Volunteer · VolunteerReady
				</div>
			</div>

			{/* Stats row */}
			<div
				style={{
					flex: 1,
					display: 'flex',
					alignItems: 'center',
					padding: '40px 60px',
					gap: 24,
				}}
			>
				<StatBox value={String(profile.totalHours)} label="Hours served" />
				<StatBox value={String(profile.orgCount)} label="Organizations" />
				<StatBox
					value={String(credCount)}
					label={credCount === 1 ? 'Credential' : 'Credentials'}
				/>
				{profile.reliabilityScore !== null && (
					<StatBox
						value={`${profile.reliabilityScore}%`}
						label="Reliability"
						highlight
					/>
				)}
			</div>

			{/* Credential pills */}
			{credCount > 0 && (
				<div
					style={{
						padding: '0 60px 40px',
						display: 'flex',
						flexWrap: 'wrap',
						gap: 8,
					}}
				>
					{profile.credentials.slice(0, 4).map((cred, i) => (
						<div
							key={i}
							style={{
								background: '#E8DCC8',
								color: '#3D3B38',
								padding: '6px 14px',
								borderRadius: 6,
								fontSize: 14,
								fontWeight: 600,
							}}
						>
							{cred.label}
						</div>
					))}
					{credCount > 4 && (
						<div
							style={{
								background: '#E8E6E1',
								color: '#787571',
								padding: '6px 14px',
								borderRadius: 6,
								fontSize: 14,
							}}
						>
							+{credCount - 4} more
						</div>
					)}
				</div>
			)}
		</div>,
		{ width: 1200, height: 630, fonts },
	);
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function StatBox({
	value,
	label,
	highlight = false,
}: {
	value: string;
	label: string;
	highlight?: boolean;
}) {
	return (
		<div
			style={{
				background: highlight ? '#1B3C2A' : '#F5F4F0',
				borderRadius: 12,
				padding: '20px 28px',
				display: 'flex',
				flexDirection: 'column',
				gap: 4,
				minWidth: 160,
			}}
		>
			<div
				style={{
					fontFamily: 'Fraunces',
					fontWeight: 700,
					fontSize: 36,
					color: highlight ? '#FAFAF8' : '#252422',
					lineHeight: 1,
				}}
			>
				{value}
			</div>
			<div
				style={{
					fontSize: 13,
					color: highlight ? 'rgba(250,250,248,0.7)' : '#787571',
					fontWeight: 600,
					letterSpacing: '0.06em',
					textTransform: 'uppercase',
				}}
			>
				{label}
			</div>
		</div>
	);
}
