// Value: protects=a Checkr connect state is only valid for the browser session
// and org it was issued to, for 15 minutes; fails_when=the MAC drops the
// session token, the org or the issue time, or the expiry check; why_new=new
// module; seam=none
import { describe, expect, it } from 'vitest';
import {
	createCheckrOAuthState,
	STATE_TTL_MS,
	verifyCheckrOAuthState,
} from './checkr-oauth-state';

const SECRET = 'test-secret';
const NOW = 1_800_000_000_000;
const issue = (orgId = 'org-1', sessionToken = 'sess-1', now = NOW) =>
	createCheckrOAuthState({ orgId, sessionToken, now }, SECRET);

describe('Checkr OAuth state', () => {
	it('returns the org for the session it was issued to', () => {
		expect(
			verifyCheckrOAuthState(
				{ state: issue(), sessionToken: 'sess-1', now: NOW },
				SECRET,
			),
		).toBe('org-1');
	});

	it('accepts a state right up to its expiry', () => {
		expect(
			verifyCheckrOAuthState(
				{ state: issue(), sessionToken: 'sess-1', now: NOW + STATE_TTL_MS },
				SECRET,
			),
		).toBe('org-1');
	});

	it.each([
		['another session', issue(), 'sess-2', NOW],
		['an expired state', issue(), 'sess-1', NOW + STATE_TTL_MS + 1],
		[
			'a state issued in the future',
			issue('org-1', 'sess-1', NOW + 1000),
			'sess-1',
			NOW,
		],
		['a swapped org', issue().replace(/^org-1/, 'org-2'), 'sess-1', NOW],
		['a bare org id', 'org-1', 'sess-1', NOW],
		['an empty state', '', 'sess-1', NOW],
		['a malformed mac', `org-1.${NOW}.zz`, 'sess-1', NOW],
	])('rejects %s', (_label, state, sessionToken, now) => {
		expect(
			verifyCheckrOAuthState({ state, sessionToken, now }, SECRET),
		).toBeNull();
	});

	it('rejects a state signed with another secret', () => {
		expect(
			verifyCheckrOAuthState(
				{ state: issue(), sessionToken: 'sess-1', now: NOW },
				'other-secret',
			),
		).toBeNull();
	});
});
