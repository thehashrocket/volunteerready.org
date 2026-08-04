import { describe, expect, it } from 'vitest';
import { getPlanFeatures } from '@/server/domain/billing';
import { pricingFaqs } from './page';

/**
 * The comparison table and the tier cards both map `PLAN_FEATURES` directly, so
 * they cannot drift from the gates — `plan-features.guard.test.ts` pins that.
 * The FAQ prose underneath them is the half that still restates tier facts in
 * sentences, and prose is exactly where the v0.41 audit found the damage: the
 * old FAQ told free-tier orgs their data was locked behind Pro while
 * `domain/roster-export.ts` deliberately shipped the export on every plan.
 *
 * So these tests bind the claims that matter back to `PLAN_FEATURES`. A future
 * change that gates the roster export, or reintroduces a headcount cap, goes red
 * here instead of leaving a paragraph quietly lying on the pricing page.
 */
describe('pricing FAQ agrees with the plan gates', () => {
	const freeAnswer = pricingFaqs.find((f) =>
		f.question.includes('free tier'),
	)?.answer;
	const exportAnswer = pricingFaqs.find((f) =>
		f.question.includes('data out'),
	)?.answer;
	const limitsAnswer = pricingFaqs.find((f) =>
		f.question.includes('limits on volunteers'),
	)?.answer;

	it('keeps the three tier-claiming answers present', () => {
		// If one is renamed away, the assertions below would pass vacuously on
		// `undefined?.includes(...)` — so fail loudly here instead.
		expect(freeAnswer, 'the "free tier" FAQ went missing').toBeDefined();
		expect(
			exportAnswer,
			'the "get my data out" FAQ went missing',
		).toBeDefined();
		expect(limitsAnswer, 'the "limits" FAQ went missing').toBeDefined();
	});

	/**
	 * The exact inversion the audit found. Kept as its own test rather than
	 * folded into the sweep below, because this one sentence is the customer-
	 * facing half of the promise in `domain/roster-export.ts`.
	 */
	it('only promises the roster export on Free while Free actually has it', () => {
		const rosterOnFree = getPlanFeatures('FREE').find((f) =>
			f.label.includes('roster CSV'),
		)?.included;

		expect(rosterOnFree, 'roster CSV export is no longer a FREE feature').toBe(
			true,
		);
		expect(
			`${freeAnswer} ${exportAnswer}`.toLowerCase(),
			'the roster export is free on every plan but the FAQ stopped saying so',
		).toContain('roster');
	});

	/**
	 * Plans differ by capability, not headcount. `maxOpportunities`/`maxMembers`
	 * were deleted from `PlanLimits` because nothing enforced them; if a cap ever
	 * comes back, this copy has to be rewritten in the same commit.
	 */
	it('does not re-advertise a headcount cap', () => {
		const allAnswers = pricingFaqs.map((f) => f.answer).join(' ');
		expect(
			/up to \d+ (opportunit|team member|volunteer|seat)/i.test(allAnswers),
			'the FAQ advertises a headcount cap again. Plans differ by capability — ' +
				'if a real cap was added, it needs an enforcement point and a ' +
				'PLAN_FEATURES row, not a sentence.',
		).toBe(false);
	});

	/**
	 * A general "no free feature is described as paid" sweep was written here and
	 * REMOVED after mutation testing, rather than shipped.
	 *
	 * It matched `PLAN_FEATURES` labels against the FAQ text by substring, and the
	 * FAQ writes prose — "skill-based matching", "portable credentials", "roster
	 * CSV export" — where the labels are formal ("Skill-based volunteer matching",
	 * "Portable volunteer credentials", "Volunteer roster CSV export"). Measured:
	 * it examined 1 of 7 free-tier labels and skipped the rest, so it read as a
	 * sweep while asserting almost nothing. Fuzzy matching was the obvious repair
	 * and the wrong one — it would fire spuriously on ordinary copy edits, and a
	 * test that cries wolf gets deleted at the worst moment.
	 *
	 * The three assertions above cover the regressions that actually happened.
	 * If a broad sweep is wanted later, the fix is to make the FAQ reference
	 * labels structurally (interpolate `PLAN_FEATURES` into the copy) rather than
	 * to make the matcher cleverer.
	 */
});
