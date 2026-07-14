import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAPTURE_ACTORS, CAPTURE_SCENARIOS } from '../../e2e/capture-scenarios';
import { CAPTURE_FRAME, MARKETING_SCREENSHOTS } from './marketing-screenshots';

// ScreenshotSection silently hides itself when an image 404s, so a missing or
// renamed asset would vanish from the marketing pages without failing any
// runtime check. This suite is the CI-time guard (issue #139 IRON RULE).

describe('marketing screenshot assets', () => {
	for (const [key, entry] of Object.entries(MARKETING_SCREENSHOTS)) {
		it(`${key} exists on disk at public${entry.src}`, () => {
			expect(
				existsSync(path.join(process.cwd(), 'public', entry.src)),
				`public${entry.src} is missing — run \`pnpm screenshots\` (CAPTURE_ONLY=${key}) to regenerate it`,
			).toBe(true);
		});
	}

	it('every entry uses the /marketing/ prefix and png format', () => {
		for (const entry of Object.values(MARKETING_SCREENSHOTS)) {
			expect(entry.src).toMatch(/^\/marketing\/[a-z0-9-]+\.png$/);
		}
	});

	it('pins the 1280×720 capture frame annotation coordinates depend on', () => {
		expect(CAPTURE_FRAME).toEqual({ width: 1280, height: 720 });
	});

	// Annotation marker coordinates are percentages of the capture frame — a
	// same-name asset replaced with a different crop would silently point
	// every marker at the wrong UI. Read the PNG IHDR header (width/height at
	// byte offsets 16/20) and pin each committed asset to the frame.
	for (const [key, entry] of Object.entries(MARKETING_SCREENSHOTS)) {
		it(`${key} matches the ${CAPTURE_FRAME.width}×${CAPTURE_FRAME.height} capture frame`, () => {
			const file = path.join(process.cwd(), 'public', entry.src);
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
