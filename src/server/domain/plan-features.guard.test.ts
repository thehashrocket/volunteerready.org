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
 *
 * Scanned WIDE (all of `app` and `server`) rather than the two directories that
 * happen to hold every gate today. `requireCompanyAccess({ minPlanTier })` is
 * callable from a Server Component, so a page could gate itself by plan under
 * `app/(app)/**` and a narrow scan would never see it — the exact silent-miss
 * this file exists to prevent. Widening costs nothing: the patterns require a
 * QUOTED tier literal, so the type annotation in `trpc/init.ts` (`minPlanTier?:
 * PlanTier`), its pass-through (`minPlanTier: opts?.minPlanTier`) and every
 * docstring mention are all correctly ignored.
 */
const SCAN_DIRS = ['app', 'server'] as const;

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
type GatedSurface = {
	tier: PlanTier;
	/**
	 * WHICH LADDER the gate reads. This is the distinction the first version of
	 * this file missed, and an independent review caught: `planTierProcedure`
	 * resolves `getOrgPlanTier` → `Organization.planTier`, while
	 * `companyScopedProcedure({ minPlanTier })` resolves `getCompanyPlanTier` →
	 * `CompanyAccount.planTier`. Different table, different customer, different
	 * price list. Treating them as one ladder put "ESG reporting" on the
	 * nonprofit pricing table and sold three surfaces an upgrade that would not
	 * have delivered it.
	 */
	scope: 'ORG' | 'COMPANY';
	/** The `PLAN_FEATURES` row that sells it. COMPANY-scope gates have none. */
	feature?: string;
};

const GATED_SURFACES: Record<string, GatedSurface> = {
	'server/trpc/routers/background-checks.ts': {
		tier: 'PRO',
		scope: 'ORG',
		feature: 'FCRA-compliant background checks',
	},
	'server/trpc/routers/shift-templates.ts': {
		tier: 'STARTER',
		scope: 'ORG',
		feature: 'Reusable shift templates',
	},
	'server/trpc/routers/analytics.ts': {
		tier: 'PRO',
		scope: 'ORG',
		feature: 'Advanced analytics dashboard',
	},
	// Company ladder — sold via the corporate band on /pricing, never the tier table.
	'server/trpc/routers/esg-report.ts': { tier: 'PRO', scope: 'COMPANY' },
	'app/api/esg-report/csv/route.ts': { tier: 'PRO', scope: 'COMPANY' },
	'app/api/esg-report/pdf/route.ts': { tier: 'PRO', scope: 'COMPANY' },
};

/**
 * A gate written in PROSE is not a gate.
 *
 * Same helper as `error-disclosure.guard.test.ts`, and it earns its place here
 * immediately: `domain/billing.ts` documents its own fields with
 * "Enforced by `companyScopedProcedure({ minPlanTier: 'PRO' })`", which the
 * pattern matched, reporting the domain module itself as an undeclared gate.
 * Any router docstring showing an example would do the same.
 *
 * LINE comments are stripped FIRST, and that order is load-bearing — the lesson
 * the error-disclosure guard had to learn the hard way. A `//` comment
 * mentioning a glob like `app/api/` + `**` contains `/*`, so running the block
 * pass first swallows every following line of real code and produces a silent
 * false ZERO. Block comments are replaced by their own newlines so reported
 * line numbers still point at real code.
 */
function stripComments(source: string): string {
	const keepLines = (m: string) => '\n'.repeat((m.match(/\n/g) ?? []).length);
	return source
		.replace(/^\s*\/\/.*$/gm, '')
		.replace(/\{\/\*[\s\S]*?\*\/\}/g, keepLines)
		.replace(/\/\*[\s\S]*?\*\//g, keepLines);
}

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
			const source = stripComments(readFileSync(path.join(ROOT, file), 'utf8'));
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

	it('every ORG-ladder gate is sold at the tier it is enforced at', () => {
		for (const [file, { tier, scope, feature }] of Object.entries(
			GATED_SURFACES,
		)) {
			if (scope !== 'ORG') continue;
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

	/**
	 * The inverse, and the one that would have caught the ESG mistake: a gate
	 * that reads `CompanyAccount.planTier` must NOT appear on the org tier table,
	 * because upgrading an Organization to Pro does not touch a CompanyAccount
	 * row. Selling it there is an upgrade the customer cannot receive.
	 */
	it('never sells a COMPANY-ladder gate on the org tier table', () => {
		const orgLabels = new Set(PLAN_FEATURES.map((f) => f.label.toLowerCase()));
		for (const [file, { scope, feature }] of Object.entries(GATED_SURFACES)) {
			if (scope !== 'COMPANY') continue;
			expect(
				feature,
				`${file} is COMPANY-scoped, so it must not name a PLAN_FEATURES row`,
			).toBeUndefined();
		}
		// Belt and braces: the org table must not mention ESG under any wording.
		expect(
			[...orgLabels].filter((l) => l.includes('esg')),
			'ESG reporting is gated on CompanyAccount.planTier. An org upgrading to ' +
				'Pro does not get it, so it cannot be a row on the org tier table — ' +
				'sell it through the corporate band on /pricing instead.',
		).toEqual([]);
	});

	it('the gate declared for a file matches the tier found in it', () => {
		const gates = findGates();
		for (const [file, { tier }] of Object.entries(GATED_SURFACES)) {
			expect(gates.get(file), `no gate found in ${file}`).toContain(tier);
		}
	});

	it('every paid PLAN_FEATURES row has a gate behind it', () => {
		const soldTiers = new Set(
			Object.values(GATED_SURFACES)
				.filter((g) => g.scope === 'ORG')
				.map((g) => g.feature),
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
