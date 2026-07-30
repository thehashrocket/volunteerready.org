/**
 * `GET /api/org/[orgId]/roster/csv` (T19).
 *
 * The behaviour under test is mostly refusal. This route emits every
 * volunteer's name, email and phone number for one tenant in a single response,
 * and it is reachable by typing a URL — so what it will NOT do matters more
 * than what it will.
 */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getServerSession: vi.fn(),
	resolveEffectiveUserId: vi.fn(),
	requireOrgAccess: vi.fn(),
	isRosterEnabledForOrg: vi.fn(),
	checkRateLimit: vi.fn(),
	findOrgByIdOrSlug: vi.fn(),
	streamRosterCsv: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/server/auth', () => ({ authOptions: {} }));
vi.mock('@/server/lib/impersonation-context', () => ({
	resolveEffectiveUserId: mocks.resolveEffectiveUserId,
}));
vi.mock('@/server/lib/rate-limit', () => ({
	checkRateLimit: mocks.checkRateLimit,
}));
vi.mock('@/server/services/featureFlagService', () => ({
	isRosterEnabledForOrg: mocks.isRosterEnabledForOrg,
}));
vi.mock('@/server/repositories/orgRepo', () => ({
	findOrgByIdOrSlug: mocks.findOrgByIdOrSlug,
}));
vi.mock('@/server/services/rosterExportService', () => ({
	streamRosterCsv: mocks.streamRosterCsv,
}));
vi.mock('@/server/services/orgAccessService', () => {
	class OrgAccessDeniedError extends Error {
		constructor(message: string) {
			super(message);
			this.name = 'OrgAccessDeniedError';
		}
	}
	return { requireOrgAccess: mocks.requireOrgAccess, OrgAccessDeniedError };
});

import { OrgAccessDeniedError } from '@/server/services/orgAccessService';
import { GET } from '../route';

const ORG_ID = 'org_target';
const USER_ID = 'user_1';

function request(orgId = ORG_ID) {
	return new NextRequest(
		new URL(`http://localhost:3005/api/org/${orgId}/roster/csv`),
	);
}

function call(orgId = ORG_ID) {
	return GET(request(orgId), { params: Promise.resolve({ orgId }) });
}

function csvBody() {
	return new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(
				new TextEncoder().encode('Name,Email\nJane,j@x.org\n'),
			);
			controller.close();
		},
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.getServerSession.mockResolvedValue({ user: { id: USER_ID } });
	mocks.resolveEffectiveUserId.mockResolvedValue({
		effectiveUserId: USER_ID,
		resolutionFailed: false,
	});
	mocks.checkRateLimit.mockResolvedValue({ success: true });
	mocks.findOrgByIdOrSlug.mockResolvedValue({
		id: ORG_ID,
		slug: 'riverside',
		name: 'Riverside',
	});
	mocks.requireOrgAccess.mockResolvedValue({ role: 'STAFF' });
	mocks.isRosterEnabledForOrg.mockResolvedValue(true);
	mocks.streamRosterCsv.mockReturnValue(csvBody());
});

describe('happy path', () => {
	it('streams a CSV with a dated attachment filename', async () => {
		const res = await call();
		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
		expect(res.headers.get('Content-Disposition')).toMatch(
			/attachment; filename="roster-riverside-\d{4}-\d{2}-\d{2}\.csv"/,
		);
		expect(await res.text()).toBe('Name,Email\nJane,j@x.org\n');
	});

	it('never lets a cache keep a copy of the PII', async () => {
		const res = await call();
		expect(res.headers.get('Cache-Control')).toBe('no-store, private');
	});

	it('does not gate on plan tier — FREE orgs can export', async () => {
		// Deliberate product decision, and the reason there is no `minPlanTier`
		// argument below. An org that cannot get its data back out has not
		// chosen to stay.
		await call();
		expect(mocks.requireOrgAccess).toHaveBeenCalledWith(
			expect.not.objectContaining({ minPlanTier: expect.anything() }),
		);
	});
});

describe('tenancy', () => {
	it('SECURITY: authorizes against the URL org, never the session', async () => {
		await call('org_from_url');
		expect(mocks.requireOrgAccess).toHaveBeenCalledWith(
			expect.objectContaining({ userId: USER_ID, orgId: ORG_ID }),
		);
		// Resolved from the path segment, so a multi-org user's "active" org in
		// session state cannot redirect this at another tenant (v0.29.2.0).
		expect(mocks.findOrgByIdOrSlug).toHaveBeenCalledWith('org_from_url');
	});

	it('SECURITY: streams the org the guard cleared, not the raw path segment', async () => {
		mocks.findOrgByIdOrSlug.mockResolvedValue({
			id: ORG_ID,
			slug: 'riverside',
			name: 'Riverside',
		});
		await call('riverside');
		expect(mocks.streamRosterCsv).toHaveBeenCalledWith(ORG_ID);
	});

	it('requires STAFF or higher', async () => {
		await call();
		expect(mocks.requireOrgAccess).toHaveBeenCalledWith(
			expect.objectContaining({ minRole: 'STAFF' }),
		);
	});
});

describe('refusals', () => {
	it('401s with no session', async () => {
		mocks.resolveEffectiveUserId.mockResolvedValue({
			effectiveUserId: null,
			resolutionFailed: false,
		});
		expect((await call()).status).toBe(401);
	});

	it('SECURITY: 401s when impersonation resolution failed, rather than falling back', async () => {
		// `resolveEffectiveUserId` returns `isImpersonating: false` on failure, so
		// a caller that only checks the id would silently act as the real admin —
		// and export whatever org THEY belong to.
		mocks.resolveEffectiveUserId.mockResolvedValue({
			effectiveUserId: 'real-admin',
			resolutionFailed: true,
		});
		expect((await call()).status).toBe(401);
		expect(mocks.streamRosterCsv).not.toHaveBeenCalled();
	});

	it('404s — not 403 — for an org the caller does not belong to', async () => {
		mocks.requireOrgAccess.mockRejectedValue(
			new OrgAccessDeniedError('Not a member of this organization'),
		);
		expect((await call()).status).toBe(404);
	});

	it('404s for an org that does not exist, indistinguishably', async () => {
		mocks.findOrgByIdOrSlug.mockResolvedValue(null);
		const missing = await call();
		mocks.findOrgByIdOrSlug.mockResolvedValue({
			id: ORG_ID,
			slug: 'r',
			name: 'R',
		});
		mocks.requireOrgAccess.mockRejectedValue(new OrgAccessDeniedError('nope'));
		const forbidden = await call();

		expect(missing.status).toBe(forbidden.status);
		expect(await missing.text()).toBe(await forbidden.text());
	});

	it('404s when the roster flag is off for that org', async () => {
		mocks.isRosterEnabledForOrg.mockResolvedValue(false);
		expect((await call()).status).toBe(404);
		expect(mocks.streamRosterCsv).not.toHaveBeenCalled();
	});

	it('checks the flag only AFTER access, so it cannot be probed', async () => {
		mocks.requireOrgAccess.mockRejectedValue(new OrgAccessDeniedError('nope'));
		await call();
		expect(mocks.isRosterEnabledForOrg).not.toHaveBeenCalled();
	});

	it('429s when rate limited, before any org lookup', async () => {
		mocks.checkRateLimit.mockResolvedValue({ success: false });
		const res = await call();
		expect(res.status).toBe(429);
		expect(res.headers.get('Retry-After')).toBe('60');
		// Bounds id enumeration through this endpoint, not just export volume.
		expect(mocks.findOrgByIdOrSlug).not.toHaveBeenCalled();
	});

	it('rate limits per user AND org', async () => {
		await call();
		expect(mocks.checkRateLimit).toHaveBeenCalledWith(
			expect.objectContaining({ prefix: 'roster:export' }),
			`${USER_ID}:${ORG_ID}`,
		);
	});

	it('rethrows an unexpected error rather than reporting 404', async () => {
		mocks.requireOrgAccess.mockRejectedValue(new Error('db is on fire'));
		await expect(call()).rejects.toThrow('db is on fire');
	});
});
