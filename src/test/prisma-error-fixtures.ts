import { Prisma } from '@/prisma/generated/client';

/**
 * The REAL P2002 shape Prisma 7 + PrismaPg produces, captured from this database.
 *
 * Note there is NO `meta.target` — that field belongs to the pre-driver-adapter
 * client. A handler written against `meta.target` matches nothing, so this helper
 * must keep reproducing the true shape or it will green-light a broken duplicate
 * check.
 *
 * Shared rather than copied because the shape is empirically discovered and
 * non-obvious: two divergent copies would let `isUniqueViolationOn` pass its own
 * tests against a shape the database no longer produces. Lives beside
 * `integration-setup.ts` because both suites that need it sit on opposite sides of
 * the src tree.
 */
export function p2002Error(
	constraint: string,
	modelName = constraint.split('_')[0],
) {
	return new Prisma.PrismaClientKnownRequestError('dup', {
		code: 'P2002',
		clientVersion: 'test',
		meta: {
			modelName,
			driverAdapterError: {
				name: 'DriverAdapterError',
				cause: {
					originalCode: '23505',
					originalMessage: `duplicate key value violates unique constraint "${constraint}"`,
					kind: 'UniqueConstraintViolation',
				},
			},
		},
	});
}

/**
 * A P2002 with no adapter message, exercising the coarse `modelName` fallback.
 * Should not occur against this database — the fallback exists for the case the
 * adapter stops reporting a message at all.
 */
export function p2002WithoutAdapterMessage(modelName: string) {
	return new Prisma.PrismaClientKnownRequestError('dup', {
		code: 'P2002',
		clientVersion: 'test',
		meta: { modelName },
	});
}
