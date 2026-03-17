// Required for Turbopack compatibility (dev script uses --turbo).
// Without this, client-side Sentry won't initialize in development.
export async function register() {
  await import("./sentry.client.config");
}
