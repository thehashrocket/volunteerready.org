/**
 * Which database the Prisma CLI connects to. Read by `prisma.config.ts` only;
 * the app and every maintenance script connect through `DATABASE_URL`
 * themselves (`src/server/repositories/prisma.ts`, `scripts/prisma-client.ts`).
 *
 * The CLI wants the DIRECT connection when one exists. On Vercel+Neon,
 * `DATABASE_URL` is the PgBouncer pooler, whose transaction mode strands the
 * session-level `pg_advisory_lock` that `migrate deploy` takes, and every
 * later deploy then fails with P1002 until the pooled backend recycles. (The
 * config used to set `directUrl` for this, but Prisma 7's config has no such
 * field; a type cast hid the error, so it was silently ignored.)
 *
 * Two rules, both found by adversarial review before this shipped:
 *
 * 1. **The direct URL is used only when it names the SAME database as
 *    `DATABASE_URL`.** It is not a separate choice of database, it is a
 *    different route to the same one. Without this check a value from
 *    `.env.local` beats one typed in the shell: `DATABASE_URL=<scratch> pnpm
 *    prisma migrate reset` would reset whatever `.env.local`'s
 *    `DATABASE_URL_UNPOOLED` names, which after a `vercel env pull` can be
 *    production. The CLI config is read by `migrate dev`/`reset`, `db push`,
 *    `db execute` and `studio` too, not just `migrate deploy`.
 * 2. **A production build never falls back to the pooler.** Falling back
 *    silently is exactly how the P1002 incident happened, so on
 *    `VERCEL_ENV=production` a missing or pooled direct URL is an error.
 */

export type CliDatabaseEnv = {
	DATABASE_URL?: string;
	DATABASE_URL_UNPOOLED?: string;
	DIRECT_DATABASE_URL?: string;
	VERCEL_ENV?: string;
	// So `process.env` itself can be passed; the keys above are the ones read.
	[key: string]: string | undefined;
};

function parseUrl(url: string): URL {
	try {
		return new URL(url);
	} catch {
		// Never echo the value: it carries a password.
		throw new Error('A database URL in the environment is not a valid URL.');
	}
}

/**
 * The host a connection actually reaches. Prisma lets a `?host=` query
 * parameter override the authority, so comparing `hostname` alone would let
 * `?host=…-pooler…` past the production check, or make two URLs aimed at
 * different servers look identical. `postgresql:` is not a WHATWG "special"
 * scheme, so `URL` does not lowercase its hostname for us.
 */
function effectiveHost(parsed: URL): string {
	return (parsed.searchParams.get('host') || parsed.hostname).toLowerCase();
}

/** Neon marks its pooled endpoint with a `-pooler` suffix on the endpoint id. */
function isPoolerHost(host: string): boolean {
	return host.split('.')[0]?.endsWith('-pooler') ?? false;
}

/**
 * Everything that decides WHERE a connection lands: effective host (pooler
 * suffix stripped), port, user, database and schema. `schema` counts because
 * Prisma treats it as the target, so `?schema=scratch` vs `public` is a
 * different reset. Transport-only params (sslmode, pgbouncer,
 * channel_binding, connect_timeout) legitimately differ and are ignored.
 */
function databaseIdentity(url: string): string {
	const parsed = parseUrl(url);
	const [first, ...rest] = effectiveHost(parsed).split('.');
	const host = [first?.replace(/-pooler$/, ''), ...rest].join('.');
	return [
		host,
		parsed.port || '5432',
		decodeURIComponent(parsed.username),
		decodeURIComponent(parsed.pathname.replace(/^\//, '')),
		parsed.searchParams.get('schema') || 'public',
	].join('|');
}

export function resolveCliDatabaseUrl(env: CliDatabaseEnv): string | undefined {
	const pooled = env.DATABASE_URL || undefined;
	const direct =
		env.DATABASE_URL_UNPOOLED || env.DIRECT_DATABASE_URL || undefined;

	if (env.VERCEL_ENV === 'production') {
		if (!direct) {
			throw new Error(
				'Production build: DATABASE_URL_UNPOOLED is not set. `prisma migrate deploy` must not run through the connection pooler (see scripts/cli-database-url.ts).',
			);
		}
		if (isPoolerHost(effectiveHost(parseUrl(direct)))) {
			throw new Error(
				'Production build: DATABASE_URL_UNPOOLED points at a -pooler host. It must be the direct (unpooled) connection.',
			);
		}
	}

	if (
		direct &&
		pooled &&
		databaseIdentity(direct) !== databaseIdentity(pooled)
	) {
		throw new Error(
			'DATABASE_URL and DATABASE_URL_UNPOOLED (or DIRECT_DATABASE_URL) name different databases. The Prisma CLI refuses to guess which one you meant: set both to the same database, or unset the direct URL.',
		);
	}

	return direct ?? pooled;
}
