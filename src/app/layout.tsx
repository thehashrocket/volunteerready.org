import { Analytics } from '@vercel/analytics/next';
import type { Metadata } from 'next';
import { Fraunces, Geist, Geist_Mono } from 'next/font/google';
import { AppToaster } from '@/components/sonner';
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
	title: 'VolunteerReady',
	description: 'Find and manage volunteer opportunities.',
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
				<AppToaster />
				<Analytics />
			</body>
		</html>
	);
}
