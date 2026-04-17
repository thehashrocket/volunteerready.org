import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	mockQueryAuditLog,
	mockListDistinctActions,
	mockListDistinctEntityTypes,
} = vi.hoisted(() => ({
	mockQueryAuditLog: vi.fn(),
	mockListDistinctActions: vi.fn(),
	mockListDistinctEntityTypes: vi.fn(),
}));

vi.mock('@/server/repositories/auditRepo', () => ({
	queryAuditLog: mockQueryAuditLog,
	listDistinctActions: mockListDistinctActions,
	listDistinctEntityTypes: mockListDistinctEntityTypes,
}));

import {
	getAuditFilterOptions,
	queryAudit,
	redactAuditMetadata,
} from '../auditQueryService';

describe('redactAuditMetadata', () => {
	it('replaces values for sensitive-looking keys but preserves the keys', () => {
		const redacted = redactAuditMetadata({
			email: 'a@b.com',
			password: 'hunter2',
			apiToken: 'abc',
			awsSecret: 'xyz',
			userKey: 'k',
			credentialHash: 'h',
		}) as Record<string, unknown>;

		expect(redacted.email).toBe('a@b.com');
		expect(redacted.password).toBe('[REDACTED]');
		expect(redacted.apiToken).toBe('[REDACTED]');
		expect(redacted.awsSecret).toBe('[REDACTED]');
		expect(redacted.userKey).toBe('[REDACTED]');
		expect(redacted.credentialHash).toBe('[REDACTED]');
	});

	it('recurses into nested objects and arrays', () => {
		const redacted = redactAuditMetadata({
			outer: { innerSecret: 'x', safe: 'y' },
			list: [{ token: 't1' }, { token: 't2' }],
		}) as Record<string, unknown>;

		expect(redacted).toEqual({
			outer: { innerSecret: '[REDACTED]', safe: 'y' },
			list: [{ token: '[REDACTED]' }, { token: '[REDACTED]' }],
		});
	});

	it('passes primitives through unchanged', () => {
		expect(redactAuditMetadata(null)).toBeNull();
		expect(redactAuditMetadata(undefined)).toBeUndefined();
		expect(redactAuditMetadata('plain')).toBe('plain');
		expect(redactAuditMetadata(42)).toBe(42);
		expect(redactAuditMetadata(true)).toBe(true);
	});

	it('matches keys case-insensitively', () => {
		const redacted = redactAuditMetadata({
			PASSWORD: 'x',
			Api_Token: 'y',
		}) as Record<string, unknown>;

		expect(redacted.PASSWORD).toBe('[REDACTED]');
		expect(redacted.Api_Token).toBe('[REDACTED]');
	});
});

describe('queryAudit', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('redacts metadata on every row and surfaces impersonatedBy', async () => {
		mockQueryAuditLog.mockResolvedValueOnce({
			rows: [
				{
					id: 'a1',
					action: 'MEMBER_INVITED',
					metadata: {
						email: 'x@y.com',
						token: 'abc',
						impersonatedBy: 'admin-1',
					},
				},
				{
					id: 'a2',
					action: 'MEMBER_INVITED',
					metadata: null,
				},
			],
			nextCursor: 'cursor-2',
		});

		const result = await queryAudit({}, { limit: 50 });

		expect(result.rows[0].metadata).toEqual({
			email: 'x@y.com',
			token: '[REDACTED]',
			impersonatedBy: 'admin-1',
		});
		expect(result.rows[0].impersonatedBy).toBe('admin-1');
		expect(result.rows[1].impersonatedBy).toBeNull();
		expect(result.nextCursor).toBe('cursor-2');
	});

	it('returns impersonatedBy=null when metadata is an array', async () => {
		mockQueryAuditLog.mockResolvedValueOnce({
			rows: [{ id: 'a1', action: 'X', metadata: [1, 2, 3] }],
			nextCursor: null,
		});

		const result = await queryAudit({}, {});

		expect(result.rows[0].impersonatedBy).toBeNull();
	});

	it('forwards filters and pagination verbatim to the repo', async () => {
		mockQueryAuditLog.mockResolvedValueOnce({ rows: [], nextCursor: null });
		const dateFrom = new Date('2026-04-01T00:00:00Z');
		const dateTo = new Date('2026-04-17T00:00:00Z');

		await queryAudit(
			{
				actorId: 'admin-1',
				entityType: 'User',
				entityId: 'u1',
				action: 'PLATFORM_ADMIN_GRANTED',
				orgId: 'org-1',
				dateFrom,
				dateTo,
				impersonatedOnly: true,
			},
			{ cursor: 'cur-1', limit: 25 },
		);

		expect(mockQueryAuditLog).toHaveBeenCalledWith(
			{
				actorId: 'admin-1',
				entityType: 'User',
				entityId: 'u1',
				action: 'PLATFORM_ADMIN_GRANTED',
				orgId: 'org-1',
				dateFrom,
				dateTo,
				impersonatedOnly: true,
			},
			{ cursor: 'cur-1', limit: 25 },
		);
	});
});

describe('getAuditFilterOptions', () => {
	it('loads actions and entity types in parallel', async () => {
		mockListDistinctActions.mockResolvedValueOnce(['A', 'B']);
		mockListDistinctEntityTypes.mockResolvedValueOnce(['User', 'Org']);

		const result = await getAuditFilterOptions();

		expect(result).toEqual({
			actions: ['A', 'B'],
			entityTypes: ['User', 'Org'],
		});
	});
});
