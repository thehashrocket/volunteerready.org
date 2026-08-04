/**
 * Magic-link identifier normalization.
 *
 * SECURITY: this exists because next-auth's DEFAULT `normalizeIdentifier`
 * validated the address BEFORE applying Unicode normalization
 * (GHSA-7rqj-j65f-68wh, critical, next-auth `>= 4.0.0, < 4.24.15`). Supplying
 * our own normalizer is the workaround the advisory itself prescribes, and it
 * keeps holding whether or not a future next-auth release regresses.
 *
 * THE ATTACK — one ASCII `@` plus a homoglyph that NFKC-collapses into a second:
 *
 *     input      victim@example.com＠attacker.com
 *                              ↑ ASCII @        ↑ U+FF20 FULLWIDTH @
 *
 *     DEFAULT (validate → normalize)          OURS (normalize → validate)
 *     ────────────────────────────────        ──────────────────────────────
 *     match(/@/g) on the RAW string           .normalize('NFKC') FIRST
 *       → 1 ASCII @  → PASSES  ✗                → victim@example.com@attacker.com
 *     ...mailer NFKC-normalizes later          match(/@/g) → 2  → REJECTED  ✓
 *       → sees 2 separators
 *       → routes the sign-in link to
 *         a mailbox the victim does
 *         not control
 *
 * The impact is account takeover with no victim interaction: the attacker
 * knows an address, requests a link for it, and receives the link themselves.
 *
 * WHY THIS MIRRORS UPSTREAM RATHER THAN IMPROVING ON IT. Every rule below is
 * copied from next-auth's default normalizer (`core/routes/signin.ts`); the
 * ONLY change is variable naming. Verified by reading 4.24.15's PATCHED
 * source: its fix is `identifier.normalize("NFKC").trim()` followed by the
 * same five checks in the same order, so this file and the patched default
 * agree on every input. Tightening a rule here — say, rejecting all
 * non-ASCII — would silently lock out an internationalized address that
 * upstream accepts, and the symptom is "sign-in is broken for one user",
 * which nobody will trace back to this file.
 *
 * MAINTENANCE — RE-VERIFY ON EVERY next-auth BUMP. Supplying
 * `normalizeIdentifier` REPLACES the default outright: `signin.ts` reads
 * `provider.normalizeIdentifier ?? (...default...)`, so upstream's copy never
 * runs while this one exists. That is fine today because the two are
 * equivalent, but it means a future release that TIGHTENS the default is
 * silently overridden by this weaker-by-then mirror, with no type error and no
 * red test. On any next-auth upgrade, diff this against
 * `node_modules/next-auth/src/core/routes/signin.ts` and reconcile. If upstream
 * ever adds a check we lack, add it here too — or delete this file and let the
 * default run.
 *
 * NOTE ON A PURE-HOMOGLYPH ADDRESS (`victim＠example.com`, no ASCII `@`): the
 * old default REJECTED it (zero ASCII `@`), we ACCEPT it and collapse it to
 * `victim@example.com`. That is safe and is upstream's behaviour too — the
 * link goes to the mailbox the address actually denotes, i.e. the legitimate
 * owner. The dangerous case is strictly the mixed one diagrammed above.
 */

/** Shared by every rejection, matching next-auth's own message. */
const INVALID = 'Invalid email address format.';

/**
 * NFKC-normalize, then validate. Order is the entire point — see the module
 * docstring. Throws on a malformed address, which next-auth's signin route
 * catches and turns into a `/error?error=EmailSignin` redirect.
 */
export function normalizeMagicLinkIdentifier(identifier: string): string {
	// STEP 1 — canonicalize. Must precede every check below.
	const normalized = identifier.normalize('NFKC').trim();

	// STEP 2 — validate, on the canonicalized string.
	// Reject multiple `@`, which after NFKC includes homoglyph separators.
	const atCount = (normalized.match(/@/g) ?? []).length;
	if (atCount !== 1) {
		throw new Error(INVALID);
	}

	// Quotes in the local part can steer downstream address parsers.
	if (normalized.includes('"')) {
		throw new Error(INVALID);
	}

	const [local, rawDomain] = normalized.toLowerCase().split('@');
	if (!local || !rawDomain) {
		throw new Error(INVALID);
	}

	// The local part may legally contain a `,`; the domain may not, so take
	// the first segment.
	const domain = rawDomain.split(',')[0];
	if (!domain.includes('.')) {
		throw new Error(INVALID);
	}

	return `${local}@${domain}`;
}
