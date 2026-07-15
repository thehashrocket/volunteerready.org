import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAPTURE_ACTORS, CAPTURE_SCENARIOS } from '../../e2e/capture-scenarios';
import { CAPTURE_FRAME, MARKETING_SCREENSHOTS } from './marketing-screenshots';

// ScreenshotSection silently hides itself when an image 404s, so a missing or
// renamed asset would vanish from the marketing pages without failing any
// runtime check. This suite is the CI-time guard (issue #139 IRON RULE).

// Flatten each manifest entry into its declared file(s) — light always,
// dark only when darkSrc is set — so existence/format/frame checks cover
// both variants without duplicating the assertion bodies.
const ASSET_FILES = Object.entries(MARKETING_SCREENSHOTS).flatMap(
	([key, entry]) => [
		{ id: key, src: entry.src },
		...(entry.darkSrc ? [{ id: `${key} (dark)`, src: entry.darkSrc }] : []),
	],
);

describe('marketing screenshot assets', () => {
	for (const { id, src } of ASSET_FILES) {
		it(`${id} exists on disk at public${src}`, () => {
			expect(
				existsSync(path.join(process.cwd(), 'public', src)),
				`public${src} is missing — run \`pnpm screenshots\` to regenerate it`,
			).toBe(true);
		});
	}

	it('every entry uses the /marketing/ prefix and png format', () => {
		for (const { src } of ASSET_FILES) {
			expect(src).toMatch(/^\/marketing\/[a-z0-9-]+\.png$/);
		}
	});

	it('pins the 1280×720 capture frame annotation coordinates depend on', () => {
		expect(CAPTURE_FRAME).toEqual({ width: 1280, height: 720 });
	});

	// Annotation marker coordinates are percentages of the capture frame — a
	// same-name asset replaced with a different crop would silently point
	// every marker at the wrong UI. Read the PNG IHDR header (width/height at
	// byte offsets 16/20) and pin each committed asset to the frame.
	for (const { id, src } of ASSET_FILES) {
		it(`${id} matches the ${CAPTURE_FRAME.width}×${CAPTURE_FRAME.height} capture frame`, () => {
			const file = path.join(process.cwd(), 'public', src);
			if (!existsSync(file)) return; // existence already asserted above
			const header = readFileSync(file).subarray(0, 24);
			expect(header.readUInt32BE(16)).toBe(CAPTURE_FRAME.width);
			expect(header.readUInt32BE(20)).toBe(CAPTURE_FRAME.height);
		});
	}
});

describe('capture scenario manifest', () => {
	it('covers every marketing screenshot exactly once', () => {
		const scenarioKeys = CAPTURE_SCENARIOS.map((s) => s.key).sort();
		const manifestKeys = Object.keys(MARKETING_SCREENSHOTS).sort();
		expect(scenarioKeys).toEqual(manifestKeys);
	});

	it('declares a dark variant if and only if the manifest entry has a darkSrc', () => {
		for (const scenario of CAPTURE_SCENARIOS) {
			const entry = MARKETING_SCREENSHOTS[scenario.key];
			const declaresDark = (scenario.variants ?? ['light']).includes('dark');
			expect(
				declaresDark,
				`${scenario.key}: scenario.variants ${declaresDark ? 'includes' : 'omits'} 'dark' but darkSrc is ${entry.darkSrc ? 'set' : 'unset'} — they must agree`,
			).toBe(entry.darkSrc !== undefined);
		}
	});

	it('only declares light and/or dark variants, never empty', () => {
		for (const scenario of CAPTURE_SCENARIOS) {
			const variants = scenario.variants ?? ['light'];
			expect(variants.length).toBeGreaterThan(0);
			for (const variant of variants) {
				expect(['light', 'dark']).toContain(variant);
			}
		}
	});

	it('only uses documented seeded accounts as actors', () => {
		const seededAccounts = Object.values(CAPTURE_ACTORS) as string[];
		for (const scenario of CAPTURE_SCENARIOS) {
			expect(seededAccounts).toContain(scenario.actor);
		}
	});

	it('declares a non-empty settle condition for every scenario', () => {
		for (const scenario of CAPTURE_SCENARIOS) {
			expect(scenario.waitForText.trim().length).toBeGreaterThan(0);
			expect(scenario.path.startsWith('/')).toBe(true);
		}
	});
});
