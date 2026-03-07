'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';

const errorMessages: Record<string, string> = {
	OAuthSignin: 'Unable to start OAuth sign-in.',
	OAuthCallback: 'OAuth sign-in failed. Try again.',
	OAuthCreateAccount: 'Could not create OAuth account.',
	EmailCreateAccount: 'Could not create email account.',
	Callback: 'Sign-in callback failed.',
	OAuthAccountNotLinked: 'Sign in with the original provider to link accounts.',
	EmailSignin: 'Email sign-in failed. Try again.',
	CredentialsSignin: 'Invalid credentials.',
	SessionRequired: 'Please sign in to continue.',
	Default: 'Unable to sign in. Try again.',
};

export function AuthFeedback() {
	const params = useSearchParams();
	const router = useRouter();

	useEffect(() => {
		const error = params.get('error');
		const success = params.get('auth') === 'success';

		if (error) {
			toast.error(errorMessages[error] ?? errorMessages.Default);
		}

		if (success) {
			toast.success('Signed in successfully.');
		}

		if (error || success) {
			const next = new URL(window.location.href);
			next.searchParams.delete('error');
			next.searchParams.delete('auth');
			router.replace(next.pathname);
		}
	}, [params, router]);

	return null;
}
