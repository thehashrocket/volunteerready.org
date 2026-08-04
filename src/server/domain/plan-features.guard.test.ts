import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { PlanTier } from '@/prisma/generated/client';
import { PLAN_FEATURES } from './billing';

/**
 * The pricing page must describe the gates that actually exist.
 *
 * The v0.41 claims audit found the pricing table wrong in both directions at
 * once, and neither error was visible from the page:
 *
 *   - It sold "CSV data exports" as Pro-only while `domain/roster-export.ts`
 *     deliberately ships the roster export on every tier. A free-tier org was
 *     told the opposite of the promise that module exists to make.
 *   - It omitted TWO features that really are gated — `shiftTemplates.*`
 *     (STARTER) and `analytics.getDashboard` (PRO) — so paid capability went
 *     unsold for months.
 *   - It sold the matching engine as Starter+, which no code enforces.
 *
 * All three are the same defect: a hand-typed copy of something the code
 * defines. `/privacy` already solved this class by walking the provider enum;
 * this is the equivalent for plan gates, and it works in BOTH directions:
 *
 *   1. Every plan gate in the codebase must be declared in `GATED_SURFACES`.
 *      Adding `planTierProcedure('PRO')` to a new router reddens this test
 *      until someone decides how it is sold.
 *   2. Every declared gate must map to a `PLAN_FEATURES` row at the SAME tier.
 *      Gating a feature at PRO while the table says Starter is a red test.
 *
 * What it deliberately does NOT check: that a `requiredTier: 'FREE'` row is
 * truly ungated. There is no gate to find, so absence proves nothing — those
 * rows are prose about capability we ship to everyone, and review is the check.
 */

const ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'../..',
);

/**
 * Where a plan gate can be written. Both spellings are real and neither is
 * reducible to the other: `planTierProcedure` gates an ORG-scoped tRPC
 * procedure, `minPlanTier` gates a COMPANY-scoped one (and the two ESG Route
 * Handlers, which are not procedures at all).
 */
const SCAN_DIRS = ['server/trpc/routers', 'app/api'] as const;

const GATE_PATTERNS: RegExp[] = [
	/planTierProcedure\(\s*['"](FREE|STARTER|PRO)['"]\s*\)/g,
	/minPlanTier:\s*['"](FREE|STARTER|PRO)['"]/g,
];

/**
 * Every plan-gated surface in the product, and the `PLAN_FEATURES` label that
 * sells it.
 *
 * Keyed by the file the gate lives in. Several gates in one file that sell the
 * same feature collapse to one entry — `shift-templates.ts` has four
 * (`create`/`update`/`remove`/`generate`) and they are one product capability.
 */
const GATED_SURFACES: Record<string, { tier: PlanTier; feature: string }> = {
	'server/trpc/routers/background-checks.ts': {
		tier: 'PRO',
		feature: 'FCRA-compliant background checks',
	},
	'server/trpc/routers/shift-templates.ts': {
		tier: 'STARTER',
		feature: 'Reusable shift templates',
	},
	'server/trpc/routers/analytics.ts': {
		tier: 'PRO',
		feature: 'Advanced analytics dashboard',
	},
	'server/trpc/routers/esg-report.ts': {
		tier: 'PRO',
		feature: 'ESG reporting dashboard & export',
	},
	'app/api/esg-report/csv/route.ts': {
		tier: 'PRO',
		feature: 'ESG reporting dashboard & export',
	},
	'app/api/esg-report/pdf/route.ts': {
		tier: 'PRO',
		feature: 'ESG reporting dashboard & export',
	},
};

function walk(dir: string): string[] {
	const abs = path.join(ROOT, dir);
	const out: string[] = [];
	let entries: ReturnType<typeof readdirSync>;
	try {
		entries = readdirSync(abs, { withFileTypes: true });
	} catch {
		return out;
	}
	for (const entry of entries) {
		const rel = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			// __tests__ fixtures contain gate literals that are not real gates.
			if (entry.name === '__tests__') continue;
			out.push(...walk(rel));
		} else if (
			/\.tsx?$/.test(entry.name) &&
			!/\.test\.tsx?$/.test(entry.name)
		) {
			out.push(rel);
		}
	}
	return out;
}

/** Returns `file -> set of tiers gated in it`. */
function findGates(): Map<string, Set<string>> {
	const found = new Map<string, Set<string>>();
	for (const dir of SCAN_DIRS) {
		for (const file of walk(dir)) {
			const source = readFileSync(path.join(ROOT, file), 'utf8');
			for (const pattern of GATE_PATTERNS) {
				for (const match of source.matchAll(pattern)) {
					const key = file.split(path.sep).join('/');
					const tiers = found.get(key) ?? new Set<string>();
					tiers.add(match[1]);
					found.set(key, tiers);
				}
			}
		}
	}
	return found;
}

describe('plan gates match what the pricing page sells', () => {
	/**
	 * Self-check, same reason as `error-disclosure.guard.test.ts`'s: a scanner
	 * that silently matches nothing passes every other assertion in this file
	 * vacuously. Pin both spellings against the files they are known to live in,
	 * so narrowing `GATE_PATTERNS` is a red test rather than a green no-op.
	 */
	it('the scanner actually finds the known gates (both spellings)', () => {
		const gates = findGates();
		// planTierProcedure(...) spelling
		expect(gates.get('server/trpc/routers/background-checks.ts')).toEqual(
			new Set(['PRO']),
		);
		expect(gates.get('server/trpc/routers/shift-templates.ts')).toEqual(
			new Set(['STARTER']),
		);
		// minPlanTier: '...' spelling, in a router AND in a raw Route Handler
		expect(gates.get('server/trpc/routers/esg-report.ts')).toEqual(
			new Set(['PRO']),
		);
		expect(gates.get('app/api/esg-report/csv/route.ts')).toEqual(
			new Set(['PRO']),
		);
		expect(gates.size).toBeGreaterThanOrEqual(
			Object.keys(GATED_SURFACES).length,
		);
	});

	it('every plan gate in the codebase is declared in GATED_SURFACES', () => {
		const undeclared = [...findGates().keys()].filter(
			(file) => !(file in GATED_SURFACES),
		);
		expect(
			undeclared,
			`Undeclared plan gate(s). A new plan gate is a pricing decision: add the ` +
				`file to GATED_SURFACES and make sure PLAN_FEATURES sells it, or the ` +
				`capability is enforced and never advertised — which is how the shift ` +
				`templates and analytics rows went missing for months.`,
		).toEqual([]);
	});

	it('every declared gate is sold at the tier it is enforced at', () => {
		for (const [file, { tier, feature }] of Object.entries(GATED_SURFACES)) {
			const row = PLAN_FEATURES.find((f) => f.label === feature);
			expect(
				row,
				`${file} names a PLAN_FEATURES row that does not exist`,
			).toBeDefined();
			expect(
				row?.requiredTier,
				`${file} enforces ${tier} but the pricing page sells "${feature}" at ` +
					`${row?.requiredTier}. One of the two is lying to a customer.`,
			).toBe(tier);
		}
	});

	it('the gate declared for a file matches the tier found in it', () => {
		const gates = findGates();
		for (const [file, { tier }] of Object.entries(GATED_SURFACES)) {
			expect(gates.get(file), `no gate found in ${file}`).toContain(tier);
		}
	});

	it('every paid PLAN_FEATURES row has a gate behind it', () => {
		const soldTiers = new Set(
			Object.values(GATED_SURFACES).map((g) => g.feature),
		);
		const unenforced = PLAN_FEATURES.filter(
			(f) => f.requiredTier !== 'FREE' && !soldTiers.has(f.label),
		).map((f) => f.label);
		expect(
			unenforced,
			`Paid feature(s) with no enforcement point. This is the "up to 3 ` +
				`opportunities" bug: a number on the pricing page that no service ` +
				`refuses on. Either gate it or move it to requiredTier: 'FREE'.`,
		).toEqual([]);
	});
});
