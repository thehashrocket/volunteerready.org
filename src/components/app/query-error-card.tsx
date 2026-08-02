'use client';

import { TRPCClientError } from '@trpc/client';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	GENERIC_ERROR_MESSAGE,
	isClientSafeErrorCode,
} from '@/server/domain/error-disclosure';

/**
 * The client half of the disclosure control. The server's `errorFormatter`
 * (`server/trpc/init.ts`) already redacted anything the allowlist rejects, so
 * this is deliberately redundant — kept because the allowlist is what decides
 * whether a message was WRITTEN for this reader, and a component should not
 * have to trust that the formatter was configured to answer that question.
 *
 * The allowlist itself lives in `server/domain/error-disclosure.ts` so the two
 * halves cannot drift.
 */
export function safeErrorMessage(
	error: { message: string; data?: { code?: string } | null } | null,
): string | undefined {
	return isClientSafeErrorCode(error?.data?.code) ? error?.message : undefined;
}

/**
 * For `catch` blocks around `mutateAsync()`, where the caught value is typed
 * `unknown` but at runtime is the same error `onError` would have received.
 *
 * Never resolve one with `err instanceof Error ? err.message : fallback`:
 * `TRPCClientError` extends `Error`, so that check PASSES and hands back the
 * raw message with the allowlist never consulted. A try/catch around a mutation
 * is exactly as leaky as an unguarded `onError`, and reads as though it is
 * being careful.
 */
export function safeCaughtErrorMessage(error: unknown): string | undefined {
	if (!(error instanceof TRPCClientError)) return undefined;
	return safeErrorMessage(error);
}

export function QueryErrorCard({
	title,
	message,
	onRetry,
	isRetrying = false,
}: {
	title: string;
	message?: string;
	onRetry: () => void;
	isRetrying?: boolean;
}) {
	return (
		<Card role="alert">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<AlertTriangle className="h-5 w-5 text-destructive" />
					{title}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4 text-sm text-muted-foreground">
				<p>{message || GENERIC_ERROR_MESSAGE}</p>
				<Button
					variant="outline"
					size="sm"
					onClick={onRetry}
					disabled={isRetrying}
				>
					<RefreshCw
						className={`mr-2 h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`}
					/>
					Try again
				</Button>
			</CardContent>
		</Card>
	);
}
