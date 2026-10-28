/**
 * pg 8 treats `sslmode=prefer|require|verify-ca` as `verify-full` and prints a
 * SECURITY WARNING to stderr on every new process (Vercel logs it as an error,
 * on every route). pg 9 will switch those modes to libpq's weaker semantics.
 *
 * The URL itself can't be fixed at the source: Neon's Vercel integration owns
 * `DATABASE_URL` and rewrites it on sync. So pin the mode here, to the
 * behaviour pg already gives us: certificate and hostname verified.
 *
 * Leaves the URL alone when it has no `sslmode` (local Postgres), uses
 * `disable`/`allow`/`verify-full`, opts into `uselibpqcompat` (that flag
 * changes what the modes mean, so rewriting would change behaviour), or
 * cannot be parsed.
 */
const ALIASED_TO_VERIFY_FULL = new Set(['prefer', 'require', 'verify-ca']);

export function pinVerifyFullSslMode(connectionString: string): string {
	let url: URL;
	try {
		url = new URL(connectionString);
	} catch {
		return connectionString;
	}
	const mode = url.searchParams.get('sslmode');
	if (!mode || !ALIASED_TO_VERIFY_FULL.has(mode)) return connectionString;
	if (url.searchParams.get('uselibpqcompat') === 'true')
		return connectionString;
	url.searchParams.set('sslmode', 'verify-full');
	return url.toString();
}
