import type { Metadata } from 'next';
import Link from 'next/link';
import { Geist, Geist_Mono } from 'next/font/google';
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

export const metadata: Metadata = {
	title: 'Volunteer Match',
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
				className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background text-foreground antialiased`}
			>
				<header className="border-b">
					<div className="container mx-auto flex h-14 items-center justify-between px-4">
						<Link className="text-sm font-semibold" href="/">
							VolunteerMatch
						</Link>
						<nav className="text-sm text-muted-foreground">
							<span>Find opportunities</span>
						</nav>
					</div>
				</header>
				{children}
				<AppToaster />
			</body>
		</html>
	);
}
