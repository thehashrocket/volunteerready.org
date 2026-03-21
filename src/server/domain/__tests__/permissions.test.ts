import { describe, expect, it } from 'vitest';
import type { Role } from '@/prisma/generated/client';
import {
	advisoryPermissionCheck,
	getPermissionsForRole,
	hasPermission,
	PERMISSIONS,
} from '../permissions';

// ---------------------------------------------------------------------------
// T5-T8: hasPermission()
// ---------------------------------------------------------------------------

describe('hasPermission', () => {
	it('T5: returns true for a valid permission the role has', () => {
		expect(hasPermission('STAFF', PERMISSIONS['opportunities.list'])).toBe(
			true,
		);
		expect(hasPermission('ADMIN', PERMISSIONS['screener.list'])).toBe(true);
		expect(hasPermission('OWNER', PERMISSIONS['members.invite'])).toBe(true);
	});

	it('T6: returns false for a permission the role does not have', () => {
		// READONLY should not have staff-level permissions
		expect(hasPermission('READONLY', PERMISSIONS['shifts.create'])).toBe(false);
		// STAFF should not have admin-level permissions
		expect(hasPermission('STAFF', PERMISSIONS['screener.list'])).toBe(false);
	});

	it('T7: returns false for an unknown role', () => {
		expect(hasPermission('SUPERADMIN' as Role, 'screener.list')).toBe(false);
	});

	it('T8: all roles have expected permission hierarchy (OWNER >= ADMIN >= STAFF >= READONLY)', () => {
		const readonlyPerms = getPermissionsForRole('READONLY');
		const staffPerms = getPermissionsForRole('STAFF');
		const adminPerms = getPermissionsForRole('ADMIN');
		const ownerPerms = getPermissionsForRole('OWNER');

		// Each higher role must be a superset of the lower role
		for (const perm of readonlyPerms) {
			expect(staffPerms.has(perm)).toBe(true);
		}
		for (const perm of staffPerms) {
			expect(adminPerms.has(perm)).toBe(true);
		}
		for (const perm of adminPerms) {
			expect(ownerPerms.has(perm)).toBe(true);
		}

		// Higher roles should have strictly more permissions
		expect(staffPerms.size).toBeGreaterThan(readonlyPerms.size);
		expect(adminPerms.size).toBeGreaterThan(staffPerms.size);
		expect(ownerPerms.size).toBeGreaterThanOrEqual(adminPerms.size);
	});
});

// ---------------------------------------------------------------------------
// T9: Advisory mismatch logging
// ---------------------------------------------------------------------------

describe('advisoryPermissionCheck', () => {
	it('T9: logs a warning when middleware allows but hasPermission denies', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		// READONLY does not have shifts.create, so advisory should warn
		advisoryPermissionCheck('READONLY', 'shifts.create', 'shifts.create');

		expect(warnSpy).toHaveBeenCalledOnce();
		expect(warnSpy.mock.calls[0]?.[0]).toContain('[RBAC advisory]');
		expect(warnSpy.mock.calls[0]?.[0]).toContain('READONLY');
		expect(warnSpy.mock.calls[0]?.[0]).toContain('shifts.create');

		warnSpy.mockRestore();
	});

	it('does not log when hasPermission agrees', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		advisoryPermissionCheck('STAFF', 'shifts.create', 'shifts.create');

		expect(warnSpy).not.toHaveBeenCalled();
		warnSpy.mockRestore();
	});
});

// ---------------------------------------------------------------------------
// T18: Permission hierarchy invariant (snapshot)
// ---------------------------------------------------------------------------

describe('permission hierarchy invariant', () => {
	it('T18: permission sets are stable (snapshot)', () => {
		const snapshot = {
			READONLY: [...getPermissionsForRole('READONLY')].sort(),
			STAFF: [...getPermissionsForRole('STAFF')].sort(),
			ADMIN: [...getPermissionsForRole('ADMIN')].sort(),
			OWNER: [...getPermissionsForRole('OWNER')].sort(),
		};

		expect(snapshot).toMatchSnapshot();
	});
});
