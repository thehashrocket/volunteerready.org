import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const sessionCookieNames = [
	'__Secure-next-auth.session-token',
	'next-auth.session-token',
];

export function middleware(req: NextRequest) {
	if (!req.nextUrl.pathname.startsWith('/app')) {
		return NextResponse.next();
	}

	const hasSessionCookie = sessionCookieNames.some((name) =>
		req.cookies.has(name),
	);

	if (!hasSessionCookie) {
		const signInUrl = new URL('/login', req.url);
		signInUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
		return NextResponse.redirect(signInUrl);
	}

	const response = NextResponse.next();
	response.headers.set('x-pathname', req.nextUrl.pathname);
	return response;
}

export const config = {
	matcher: ['/app/:path*'],
};
