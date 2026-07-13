import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { getLocation } from '@/lib/locations';
import { getOgPageMeta } from '@/lib/public-pages';
import { prisma } from '@/server/repositories/prisma';

export const runtime = 'nodejs';

const VALID_TYPES = [
	'apply',
	'opportunities',
	'stories',
	'page',
	'location',
] as const;
type OgType = (typeof VALID_TYPES)[number];

function truncate(text: string, max: number): string {
	return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

const fontCache = new Map<string, Buffer>();

function loadFont(filename: string): Buffer {
	let buf = fontCache.get(filename);
	if (!buf) {
		buf = readFileSync(join(process.cwd(), 'public', 'fonts', filename));
		fontCache.set(filename, buf);
	}
	return buf;
}

const PAGE_META = getOgPageMeta();

function getHeading(type: OgType, orgName: string, slug: string): string {
	if (type === 'page') return PAGE_META[slug]?.heading ?? 'VolunteerReady';
	if (type === 'location') {
		const loc = getLocation(slug);
		return loc?.og.heading ?? 'VolunteerReady';
	}
	switch (type) {
		case 'apply':
			return `Apply to volunteer with ${orgName}`;
		case 'opportunities':
			return `Volunteer opportunities at ${orgName}`;
		case 'stories':
			return `${orgName} — Impact Story`;
	}
}

function getSubheading(type: OgType, slug: string): string {
	if (type === 'page') return PAGE_META[slug]?.subheading ?? '';
	if (type === 'location') {
		const loc = getLocation(slug);
		return loc?.og.subheading ?? '';
	}
	switch (type) {
		case 'apply':
			return 'Volunteer Application';
		case 'opportunities':
			return 'Open Positions';
		case 'stories':
			return 'Success Story';
	}
}

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ type: string; slug: string }> },
) {
	const { type, slug } = await params;

	if (!VALID_TYPES.includes(type as OgType)) {
		return new Response('Invalid type', { status: 400 });
	}

	const ogType = type as OgType;
	let orgName = '';

	if (ogType === 'page') {
		if (!PAGE_META[slug]) {
			return new Response('Unknown page', { status: 404 });
		}
	} else if (ogType === 'location') {
		if (!getLocation(slug)) {
			return new Response('Unknown location', { status: 404 });
		}
	} else {
		let org = await prisma.organization.findUnique({
			where: { slug },
			select: { name: true },
		});
		if (!org) {
			// Social platforms cache absolute og:image URLs — pre-rename shares
			// still request the old slug's image after the org renames.
			const { findCurrentSlugByHistory } = await import(
				'@/server/repositories/orgRepo'
			);
			const currentSlug = await findCurrentSlugByHistory(slug);
			if (currentSlug) {
				org = await prisma.organization.findUnique({
					where: { slug: currentSlug },
					select: { name: true },
				});
			}
		}
		if (!org) {
			return new Response('Not found', { status: 404 });
		}
		orgName = truncate(org.name, 60);
	}

	let fonts: {
		name: string;
		data: Buffer;
		weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
	}[];
	try {
		const frauncesBold = loadFont('fraunces-bold.ttf');
		const geistRegular = loadFont('geist-regular.ttf');
		const geistSemibold = loadFont('geist-semibold.ttf');
		fonts = [
			{ name: 'Fraunces', data: frauncesBold, weight: 700 },
			{ name: 'Geist', data: geistRegular, weight: 400 },
			{ name: 'Geist', data: geistSemibold, weight: 600 },
		];
	} catch (e) {
		console.warn('[OG] Font loading failed, using system fallback:', e);
		fonts = [];
	}

	const heading = getHeading(ogType, orgName, slug);
	const subheading = getSubheading(ogType, slug);

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
					padding: '48px 60px',
					display: 'flex',
					flexDirection: 'column',
					gap: 12,
					flex: 1,
					justifyContent: 'center',
				}}
			>
				<div
					style={{
						fontSize: 14,
						color: '#C4A882',
						fontWeight: 600,
						letterSpacing: '0.1em',
						textTransform: 'uppercase',
					}}
				>
					{subheading}
				</div>
				<div
					style={{
						fontFamily: 'Fraunces',
						fontWeight: 700,
						fontSize: 52,
						color: '#FAFAF8',
						lineHeight: 1.15,
					}}
				>
					{heading}
				</div>
			</div>

			{/* Footer */}
			<div
				style={{
					padding: '28px 60px',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
				}}
			>
				<div
					style={{
						fontFamily: 'Fraunces',
						fontWeight: 700,
						fontSize: 22,
						color: '#1B3C2A',
					}}
				>
					VolunteerReady
				</div>
				<div
					style={{
						fontSize: 14,
						color: '#787571',
					}}
				>
					www.volunteerready.org
				</div>
			</div>
		</div>,
		{
			width: 1200,
			height: 630,
			fonts,
			headers: {
				'Cache-Control': 's-maxage=86400, stale-while-revalidate',
			},
		},
	);
}
