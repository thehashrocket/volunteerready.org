'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// tRPC error codes safe to show verbatim. Anything else (INTERNAL_SERVER_ERROR
// and friends) may carry raw database/internal detail — show generic copy.
const CLIENT_SAFE_ERROR_CODES = new Set([
	'BAD_REQUEST',
	'UNAUTHORIZED',
	'FORBIDDEN',
	'NOT_FOUND',
	'CONFLICT',
	'PRECONDITION_FAILED',
	'TOO_MANY_REQUESTS',
]);

export function safeErrorMessage(
	error: { message: string; data?: { code?: string } | null } | null,
): string | undefined {
	if (!error?.data?.code) return undefined;
	return CLIENT_SAFE_ERROR_CODES.has(error.data.code)
		? error.message
		: undefined;
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
				<p>{message || 'Something went wrong. Please try again.'}</p>
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
