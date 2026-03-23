import type { Metadata, Viewport } from 'next';
import { Fraunces, Geist, Geist_Mono } from 'next/font/google';
import { ConsentedAnalytics } from '@/components/consented-analytics';
import { CookieConsentBanner } from '@/components/cookie-consent-banner';
import { IosInstallPrompt } from '@/components/ios-install-prompt';
import { AppToaster } from '@/components/sonner';
import { SwRegister } from '@/components/sw-register';
import { SwUpdateBanner } from '@/components/sw-update-banner';
import { BASE_URL } from '@/lib/constants';
import './globals.css';

const geistSans = Geist({
	variable: '--font-geist-sans',
	subsets: ['latin'],
	display: 'swap',
});

const geistMono = Geist_Mono({
	variable: '--font-geist-mono',
	subsets: ['latin'],
	display: 'swap',
});

const fraunces = Fraunces({
	variable: '--font-fraunces',
	subsets: ['latin'],
	style: ['normal', 'italic'],
	weight: ['400', '700', '900'],
	display: 'swap',
});

export const metadata: Metadata = {
	metadataBase: new URL(BASE_URL),
	title: 'VolunteerReady',
	description: 'Find and manage volunteer opportunities.',
	manifest: '/manifest.webmanifest',
	appleWebApp: {
		capable: true,
		statusBarStyle: 'default',
		title: 'VolunteerReady',
	},
	icons: {
		apple: '/icons/apple-touch-icon.png',
	},
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
	verification: {
		other: {
			'msvalidate.01': '9B15CB757D883A353912C47049B56E4E',
		},
	},
};

export const viewport: Viewport = {
	themeColor: '#1B3C2A',
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
				<script
					type="application/ld+json"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data requires innerHTML
					dangerouslySetInnerHTML={{
						__html: JSON.stringify({
							'@context': 'https://schema.org',
							'@type': 'Organization',
							name: 'VolunteerReady',
							url: BASE_URL,
							logo: `${BASE_URL}/icons/icon-512x512.png`,
							description:
								'Trusted infrastructure for volunteer engagement. Screen, credential, match, and schedule volunteers.',
						}).replace(/</g, '\\u003c'),
					}}
				/>
				<IosInstallPrompt />
				<SwRegister />
				<SwUpdateBanner />
				<AppToaster />
				<ConsentedAnalytics />
				<CookieConsentBanner />
			</body>
		</html>
	);
}
