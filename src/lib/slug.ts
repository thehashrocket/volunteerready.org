/**
 * Convert an org name into a URL-safe, lowercase, kebab-case slug.
 * Example: "Paws & Claws Rescue!" → "paws-claws-rescue"
 */
export function generateSlug(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

/**
 * Find a unique slug by checking availability via the provided callback.
 * If the base slug is taken, appends a 4-character random suffix and retries.
 * Throws if a unique slug cannot be found within maxAttempts.
 */
export async function findUniqueSlug(
	base: string,
	isSlugTaken: (slug: string) => Promise<boolean>,
	maxAttempts = 10,
): Promise<string> {
	if (!(await isSlugTaken(base))) return base;

	for (let i = 0; i < maxAttempts; i++) {
		const suffix = Math.random().toString(36).slice(2, 6);
		const candidate = `${base}-${suffix}`;
		if (!(await isSlugTaken(candidate))) return candidate;
	}

	throw new Error(
		`Could not find a unique slug for "${base}" after ${maxAttempts} attempts`,
	);
}
