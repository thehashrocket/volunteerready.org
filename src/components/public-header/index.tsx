'use client';

import dynamic from 'next/dynamic';
import type { Session } from 'next-auth';
import { useEffect, useState } from 'react';
import {
	AvatarSkeleton,
	HeaderShell,
	SignedOutDesktop,
	SignedOutMobile,
} from './shell';

function LoadingHeader() {
	return (
		<HeaderShell
			desktopAccount={<AvatarSkeleton />}
			mobileAccount={() => null}
		/>
	);
}

// next-auth/react, tRPC + React Query and the account dropdown live in this
// chunk. It is only requested once a session is known to exist.
const SignedInHeader = dynamic(() => import('./account'), {
	ssr: false,
	loading: LoadingHeader,
});

export type SessionPresence =
	| { status: 'loading' }
	| { status: 'unauthenticated' }
	| { status: 'authenticated'; session: Session };

/** Reads the same endpoint next-auth's useSession() does, without its client. */
export async function fetchSessionPresence(): Promise<SessionPresence> {
	try {
		const res = await fetch('/api/auth/session', {
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/json' },
		});
		if (!res.ok) return { status: 'unauthenticated' };
		const body = (await res.json()) as Partial<Session> | null;
		return body?.user
			? { status: 'authenticated', session: body as Session }
			: { status: 'unauthenticated' };
	} catch {
		return { status: 'unauthenticated' };
	}
}

function useSessionPresence(): SessionPresence {
	const [presence, setPresence] = useState<SessionPresence>({
		status: 'loading',
	});

	useEffect(() => {
		let cancelled = false;
		const check = () => {
			void fetchSessionPresence().then((next) => {
				if (!cancelled) setPresence(next);
			});
		};
		check();
		// useSession() refetched on tab focus; keep that, so signing in through
		// a magic link in another tab shows up when the visitor comes back.
		const onVisible = () => {
			if (document.visibilityState === 'visible') check();
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			cancelled = true;
			document.removeEventListener('visibilitychange', onVisible);
		};
	}, []);

	return presence;
}

/**
 * Public header. Anonymous visitors get the shell plus "Sign in" and never
 * download any auth code; signed-in visitors get ./account.tsx, which brings
 * its own SessionProvider and TRPCProvider. Safe to use in any layout.
 */
export function PublicHeader() {
	const presence = useSessionPresence();

	if (presence.status === 'authenticated') {
		return <SignedInHeader session={presence.session} />;
	}
	// Same element type for loading and signed-out, so the swap keeps the
	// mobile menu's open state instead of remounting the header.
	const signedOut = presence.status === 'unauthenticated';
	return (
		<HeaderShell
			desktopAccount={signedOut ? <SignedOutDesktop /> : <AvatarSkeleton />}
			mobileAccount={(menu) =>
				signedOut ? <SignedOutMobile {...menu} /> : null
			}
		/>
	);
}
