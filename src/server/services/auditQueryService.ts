import {
	type AuditQueryFilters,
	listDistinctActions,
	listDistinctEntityTypes,
	queryAuditLog,
} from '@/server/repositories/auditRepo';

const SENSITIVE_KEY_PATTERN = /password|token|secret|key|credential/i;
const REDACTED_VALUE = '[REDACTED]';

// Seen-warning de-dup — avoid log spam.
const warnedKeys = new Set<string>();

/**
 * Redact any key in `metadata` matching the sensitive-key pattern.
 *
 * Leaves the key in place so readers can see the field existed — only the
 * value is replaced with `[REDACTED]`. Warns the first time a new sensitive
 * key is encountered so we can fix the upstream writer.
 */
export function redactAuditMetadata(value: unknown): unknown {
	if (value == null) return value;
	if (Array.isArray(value)) return value.map(redactAuditMetadata);
	if (typeof value !== 'object') return value;

	const record = value as Record<string, unknown>;
	const out: Record<string, unknown> = {};
	for (const [key, val] of Object.entries(record)) {
		if (SENSITIVE_KEY_PATTERN.test(key)) {
			if (!warnedKeys.has(key)) {
				warnedKeys.add(key);
				console.warn(
					`[auditQueryService] sensitive-looking key "${key}" encountered in audit metadata — check upstream writer`,
				);
			}
			out[key] = REDACTED_VALUE;
			continue;
		}
		out[key] = redactAuditMetadata(val);
	}
	return out;
}

export async function queryAudit(
	filters: AuditQueryFilters,
	pagination: { cursor?: string | null; limit?: number },
) {
	const { rows, nextCursor } = await queryAuditLog(filters, pagination);

	return {
		rows: rows.map((row) => ({
			...row,
			metadata: redactAuditMetadata(row.metadata),
			impersonatedBy:
				typeof row.metadata === 'object' &&
				row.metadata !== null &&
				!Array.isArray(row.metadata)
					? (((row.metadata as Record<string, unknown>).impersonatedBy as
							| string
							| null
							| undefined) ?? null)
					: null,
		})),
		nextCursor,
	};
}

export async function getAuditFilterOptions() {
	const [actions, entityTypes] = await Promise.all([
		listDistinctActions(),
		listDistinctEntityTypes(),
	]);
	return { actions, entityTypes };
}
