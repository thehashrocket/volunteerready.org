/**
 * Whether the currently deployed release is worth interrupting a coordinator
 * over.
 *
 * `/api/version` returns this alongside the build identity. `silent` updates
 * the account-menu affordance and renders no strip; `notice` renders the
 * in-flow update strip. (Plan decisions 22, 34, 45, 47, 51.)
 *
 * WHY A DEFAULT OF `silent`, AND WHY THAT IS NOT THE SAME AS "OFF":
 * this project ships roughly three times a day, and most of those are
 * dependency bumps, CI changes and docs with no client-visible effect.
 * Interrupting a coordinator on each one trains a dismiss-without-reading
 * reflex within a month, at which point the feature has NEGATIVE value: it has
 * spent the attention it needed for the one day a real skew matters.
 *
 * WHY THE VALUE LIVES HERE RATHER THAN IN AN ENV VAR:
 * baked at build time so it shares the lifecycle of the release it describes,
 * and visible in the diff at ship time so promoting a release is a deliberate,
 * reviewable one-line edit. A dashboard env var drifts from the release and
 * nothing reviews it.
 *
 * WHY IT IS NOT DERIVED FROM THE VERSION NUMBER:
 * `/ship` bumps a segment on almost every PR, and "does this matter to a
 * coordinator" is not a function of the version number. A `feat:` can be
 * invisible to staff and a `fix:` can be the thing they have been waiting for.
 *
 * SERVER-ONLY, and the reason is not stylistic. `APP_VERSION` describes *this
 * client's own build*; this describes *the newly deployed server's build*.
 * Opposite provenance. A client importing this gets the severity of the build
 * it is already running, which answers no question anyone has. The guard in
 * `scripts/release-severity-gate.test.ts` enforces it — being under
 * `server/domain/**` is a convention, not a compiler error, because this repo
 * does not use the `server-only` package.
 */
export type ReleaseSeverity = 'silent' | 'notice';

export const RELEASE_SEVERITY_VALUES = ['silent', 'notice'] as const;

/**
 * Set deliberately at ship time. `/ship` proposes a value from the commit type
 * (`feat:` -> `notice`; `chore:`/`ci:`/`docs:` -> `silent`) and you confirm or
 * override it.
 */
export const RELEASE_SEVERITY: ReleaseSeverity = 'notice';

/**
 * The version `RELEASE_SEVERITY` above was decided FOR, and the whole reason
 * this file can be guarded at all.
 *
 * Without it there is no checkable difference between "we looked at this
 * release and it is genuinely silent" and "nobody has touched this constant
 * since the feature shipped." With it, `RELEASE_SEVERITY_DECIDED_FOR !==
 * VERSION` is a red test, so a value cannot silently carry across releases —
 * in particular a `notice` cannot keep firing for three releases after the
 * thing it announced.
 *
 * This is deliberately NOT a claim that the severity is *correct*. No test can
 * check that; it is a judgement about the release's content. The guard checks
 * the one thing a machine can see — that the answer belongs to this version.
 *
 * MUST be updated in the same commit that bumps `VERSION`.
 */
export const RELEASE_SEVERITY_DECIDED_FOR = '0.41.16.0';
