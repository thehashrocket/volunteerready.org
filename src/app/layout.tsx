import type { Metadata } from 'next';
import { Fraunces, Geist, Geist_Mono } from 'next/font/google';
import { ConsentedAnalytics } from '@/components/consented-analytics';
import { CookieConsentBanner } from '@/components/cookie-consent-banner';
import { AppToaster } from '@/components/sonner';
import { SwRegister } from '@/components/sw-register';
import { SwUpdateBanner } from '@/components/sw-update-banner';
import './globals.css';

const geistSans = Geist({
	variable: '--font-geist-sans',
	subsets: ['latin'],
});

const geistMono = Geist_Mono({
	variable: '--font-geist-mono',
	subsets: ['latin'],
});

const fraunces = Fraunces({
	variable: '--font-fraunces',
	subsets: ['latin'],
	style: ['normal', 'italic'],
	weight: ['400', '700', '900'],
});

export const metadata: Metadata = {
	metadataBase: new URL('https://www.volunteerready.org'),
	title: 'VolunteerReady',
	description: 'Find and manage volunteer opportunities.',
	manifest: '/manifest.webmanifest',
	themeColor: '#1B3C2A',
	openGraph: {
		title: 'VolunteerReady',
		description: 'Find and manage volunteer opportunities.',
		url: 'https://www.volunteerready.org/',
		siteName: 'VolunteerReady',
		images: ['/images/og-image.png'],
	},
	twitter: {
		card: 'summary_large_image',
		title: 'VolunteerReady',
		description: 'Find and manage volunteer opportunities.',
		images: ['/images/og-image.png'],
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body
				className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} min-h-screen bg-background text-foreground antialiased`}
			>
				{children}
				<SwRegister />
				<SwUpdateBanner />
				<AppToaster />
				<ConsentedAnalytics />
				<CookieConsentBanner />
			</body>
		</html>
	);
}
