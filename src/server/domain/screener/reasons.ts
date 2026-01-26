// src/server/domain/screener/reasons.ts
import type { ScreeningReason } from './types';

export function reason(code: string, message: string): ScreeningReason {
	return { code, message };
}
