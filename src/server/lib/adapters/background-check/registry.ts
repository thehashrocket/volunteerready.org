/**
 * registry.ts — Background check adapter factory.
 *
 * Returns the correct adapter based on BackgroundCheckProvider enum.
 * Sterling uses API keys (env-var-as-gate), Checkr uses OAuth.
 */

import type { BackgroundCheckProvider } from '@/prisma/generated/client';
import { checkrAdapter } from './checkr';
import { sterlingAdapter } from './sterling';
import type { BackgroundCheckAdapter } from './types';

/**
 * Get the adapter for a given provider.
 * Returns null if the provider is not configured (e.g., Sterling without env vars).
 */
export function getAdapter(
	provider: BackgroundCheckProvider,
): BackgroundCheckAdapter | null {
	switch (provider) {
		case 'CHECKR':
			return checkrAdapter;
		case 'STERLING':
			return sterlingAdapter;
		default:
			return null;
	}
}
