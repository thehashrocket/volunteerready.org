import { TRPCError } from '@trpc/server';
import {
	FEATURE_FLAG_REGISTRY,
	getFlagDefinition,
	isKnownFlag,
	STAFF_CREATED_VOLUNTEERS_FLAG,
} from '@/server/domain/feature-flags';
import { writeAuditLogTx } from '@/server/repositories/auditRepo';
import {
	getFlag,
	getFlagWithPriorTx,
	listOrgFlags,
	upsertFlagTx,
} from '@/server/repositories/featureFlagRepo';
import { prisma } from '@/server/repositories/prisma';

const FEATURE_FLAG_SET_ACTION = 'FEATURE_FLAG_SET';
const FEATURE_FLAG_ENTITY = 'FeatureFlag';

export async function listOrgFeatureFlags(orgId: string) {
	const overrides = await listOrgFlags(orgId);
	const overrideMap = new Map(overrides.map((o) => [o.key, o]));

	return FEATURE_FLAG_REGISTRY.map((def) => {
		const override = overrideMap.get(def.key);
		return {
			key: def.key,
			label: def.label,
			description: def.description,
			defaultEnabled: def.defaultEnabled,
			enabled: override?.enabled ?? def.defaultEnabled,
			hasOverride: !!override,
			updatedAt: override?.updatedAt ?? null,
			updatedBy: override?.updatedBy ?? null,
		};
	});
}

export async function setFeatureFlag(args: {
	orgId: string;
	key: string;
	enabled: boolean;
	reason: string;
	actorId: string;
}) {
	const def = getFlagDefinition(args.key);
	if (!def) {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: `Unknown feature flag: ${args.key}`,
		});
	}

	return prisma.$transaction(async (tx) => {
		const org = await tx.organization.findUnique({
			where: { id: args.orgId },
			select: { id: true, slug: true },
		});
		if (!org) {
			throw new TRPCError({
				code: 'NOT_FOUND',
				message: 'Organization not found.',
			});
		}

		const prior = await getFlagWithPriorTx(tx, args.orgId, args.key);
		const priorEffective = prior?.enabled ?? def.defaultEnabled;

		const updated = await upsertFlagTx(tx, {
			orgId: args.orgId,
			key: args.key,
			enabled: args.enabled,
			updatedById: args.actorId,
		});

		await writeAuditLogTx(tx, {
			actorId: args.actorId,
			orgId: args.orgId,
			action: FEATURE_FLAG_SET_ACTION,
			entityType: FEATURE_FLAG_ENTITY,
			entityId: updated.id,
			metadata: {
				key: args.key,
				enabled: args.enabled,
				priorEnabled: priorEffective,
				hadOverride: !!prior,
				reason: args.reason,
				slug: org.slug,
			},
		});

		return updated;
	});
}

/**
 * Returns whether a feature flag is enabled for an org. Falls back to the
 * registry default when no override exists. Unknown keys return false.
 */
export async function isFeatureEnabled(
	orgId: string,
	key: string,
): Promise<boolean> {
	if (!isKnownFlag(key)) return false;
	const override = await getFlag(orgId, key);
	if (override) return override.enabled;
	const def = getFlagDefinition(key);
	return def?.defaultEnabled ?? false;
}

/**
 * Is the volunteer roster enabled for THIS org id?
 *
 * The predicate has six callers now and they do not share a shape: a tRPC
 * middleware (`rosterProcedure`), two Server Components (the app shell's nav
 * gate in `app/(app)/app/layout.tsx` and `resolveVolunteerRosterFlag`), a raw
 * Route Handler (the roster CSV export), and the two onboarding surfaces, which
 * hide the roster milestone rather than showing a step that links to a route
 * the org would be redirected out of.
 *
 * One definition rather than six copies of `isFeatureEnabled(orgId, FLAG)`,
 * because grepping `rosterProcedure` does NOT enumerate every roster surface —
 * two profile procedures are deliberately ungated, the export is not a
 * procedure, and the onboarding checks are reads rather than guards. When the
 * flag retires, grep THIS.
 *
 * It lives in this service, not in `lib/roster-flag.ts` where it started,
 * because that module imports next-auth and `next/headers` to resolve the
 * session — weight the onboarding queries and the tRPC middleware should not
 * take on for a one-line flag read.
 */
export function isRosterEnabledForOrg(orgId: string): Promise<boolean> {
	return isFeatureEnabled(orgId, STAFF_CREATED_VOLUNTEERS_FLAG);
}
