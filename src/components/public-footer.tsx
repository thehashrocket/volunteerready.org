import Link from 'next/link';
import { getFooterPages } from '@/lib/public-pages';

const footerLinks = [
	{
		heading: 'Platform',
		links: getFooterPages('Platform'),
	},
	{
		heading: 'For Volunteers',
		links: [
			{ label: 'Why VolunteerReady', href: '/for/volunteers' },
			{ label: 'Sign in', href: '/login' },
		],
	},
	{
		heading: 'For Nonprofits',
		links: [
			{ label: 'Why VolunteerReady', href: '/for/nonprofits' },
			{
				label: 'Set up your organization',
				href: '/login?callbackUrl=/app/onboarding',
			},
		],
	},
	{
		heading: 'For Employers',
		links: [
			{ label: 'Why VolunteerReady', href: '/for/employers' },
			{ label: 'Corporate Pricing', href: '/pricing' },
		],
	},
	{
		heading: 'Legal',
		links: getFooterPages('Legal'),
	},
];

export function PublicFooter() {
	return (
		<footer className="border-t border-border/60 bg-muted/30">
			<div className="mx-auto max-w-5xl px-4 py-12">
				{/* Brand + links */}
				<div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-6">
					{/* Brand lockup */}
					<div className="lg:col-span-1">
						<Link href="/" className="flex min-h-[44px] items-center gap-2.5">
							<div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
								V
							</div>
							<span className="text-sm font-semibold tracking-tight text-foreground">
								VolunteerReady
							</span>
						</Link>
						<p className="mt-3 text-xs leading-relaxed text-muted-foreground">
							Connecting volunteers with the missions that need them most.
						</p>
					</div>

					{/* Link columns */}
					{footerLinks.map((col) => (
						<div key={col.heading}>
							<p className="mb-3 text-xs font-semibold uppercase tracking-widest text-foreground/70">
								{col.heading}
							</p>
							<ul className="space-y-1">
								{col.links.map((link) => (
									<li key={link.href}>
										<Link
											href={link.href}
											className="inline-flex min-h-[44px] items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
										>
											{link.label}
										</Link>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>

				{/* Copyright */}
				<div className="mt-10 border-t border-border/40 pt-6 text-center text-xs text-muted-foreground">
					© {new Date().getFullYear()} VolunteerReady. All rights reserved.
				</div>
			</div>
		</footer>
	);
}
