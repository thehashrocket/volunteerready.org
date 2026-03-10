import { Building2, ClipboardList, Heart, Search } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Home() {
	return (
		<div className="flex flex-col">
			{/* ── Hero section ── */}
			<section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/10 px-4 py-20 sm:py-28">
				{/* Decorative abstract SVG */}
				<div
					aria-hidden="true"
					className="pointer-events-none absolute right-0 top-0 -translate-y-1/4 translate-x-1/4 opacity-[0.06]"
				>
					<svg
						aria-hidden="true"
						width="600"
						height="600"
						viewBox="0 0 600 600"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<circle
							cx="300"
							cy="300"
							r="280"
							fill="currentColor"
							className="text-primary"
						/>
						<ellipse
							cx="300"
							cy="200"
							rx="120"
							ry="200"
							fill="currentColor"
							className="text-accent"
							transform="rotate(-20 300 200)"
						/>
						<ellipse
							cx="400"
							cy="380"
							rx="100"
							ry="180"
							fill="currentColor"
							className="text-primary"
							transform="rotate(35 400 380)"
						/>
						<ellipse
							cx="180"
							cy="360"
							rx="90"
							ry="160"
							fill="currentColor"
							className="text-accent"
							transform="rotate(-15 180 360)"
						/>
					</svg>
				</div>

				<div className="relative mx-auto max-w-2xl text-center">
					<p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-primary/70">
						VolunteerReady
					</p>
					<h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl sm:leading-tight">
						Connect with missions{' '}
						<em className="italic text-primary">that need you most.</em>
					</h1>
					<p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
						Whether you're ready to give your time or building a nonprofit that
						changes lives — we make the connection simple, warm, and human.
					</p>
					<div className="mt-8 flex flex-wrap items-center justify-center gap-3">
						<Button asChild size="lg" className="rounded-full px-8">
							<Link href="/login?callbackUrl=/app/my-applications">
								<Heart className="h-4 w-4" />
								Start volunteering
							</Link>
						</Button>
						<Button
							asChild
							variant="outline"
							size="lg"
							className="rounded-full px-8"
						>
							<Link href="/login?callbackUrl=/app/onboarding">
								Set up your organization
							</Link>
						</Button>
					</div>
				</div>
			</section>

			{/* ── Two-path cards ── */}
			<section className="mx-auto w-full max-w-3xl px-4 py-16">
				<div className="grid gap-5 sm:grid-cols-2">
					{/* Volunteer card */}
					<Card className="group relative overflow-hidden border-border/70 transition-shadow hover:shadow-md">
						<div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-success to-primary" />
						<CardContent className="flex flex-col gap-5 pb-7 pt-7">
							<div className="flex h-11 w-11 items-center justify-center rounded-full bg-success/15">
								<ClipboardList className="h-5 w-5 text-success-foreground" />
							</div>
							<div className="space-y-1.5">
								<p className="font-semibold text-foreground">I'm a volunteer</p>
								<p className="text-sm leading-relaxed text-muted-foreground">
									Track your applications, find opportunities nearby, and
									connect with causes you care about.
								</p>
							</div>
							<Button
								asChild
								variant="outline"
								className="mt-auto w-full rounded-lg"
							>
								<Link href="/login?callbackUrl=/app/my-applications">
									Sign in to track my volunteering
								</Link>
							</Button>
						</CardContent>
					</Card>

					{/* Organization card */}
					<Card className="group relative overflow-hidden border-primary/20 bg-primary text-primary-foreground transition-shadow hover:shadow-md">
						<CardContent className="flex flex-col gap-5 pb-7 pt-7">
							<div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15">
								<Building2 className="h-5 w-5 text-primary-foreground" />
							</div>
							<div className="space-y-1.5">
								<p className="font-semibold text-primary-foreground">
									I run a nonprofit
								</p>
								<p className="text-sm leading-relaxed text-primary-foreground/75">
									Create your organization profile, post opportunities, and
									screen volunteers — all in one place.
								</p>
							</div>
							<Button
								asChild
								className="mt-auto w-full rounded-lg bg-white text-primary hover:bg-white/90"
							>
								<Link href="/login?callbackUrl=/app/onboarding">
									Set up your organization
								</Link>
							</Button>
						</CardContent>
					</Card>
				</div>
			</section>

			{/* ── How it works ── */}
			<section className="bg-muted/40 px-4 py-16">
				<div className="mx-auto max-w-3xl">
					<h2 className="font-display mb-10 text-center text-2xl font-bold text-foreground">
						How it works
					</h2>
					<div className="grid gap-8 sm:grid-cols-3">
						<div className="text-center">
							<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
								<Search className="h-5 w-5 text-primary" />
							</div>
							<h3 className="mb-1 font-semibold text-foreground">
								1. Find opportunities
							</h3>
							<p className="text-sm leading-relaxed text-muted-foreground">
								Browse vetted volunteer opportunities from nonprofits in your
								community.
							</p>
						</div>
						<div className="text-center">
							<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/20">
								<ClipboardList className="h-5 w-5 text-accent-foreground" />
							</div>
							<h3 className="mb-1 font-semibold text-foreground">
								2. Apply with ease
							</h3>
							<p className="text-sm leading-relaxed text-muted-foreground">
								Complete a simple screening form — no lengthy paperwork, just
								the essentials.
							</p>
						</div>
						<div className="text-center">
							<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/15">
								<Heart className="h-5 w-5 text-success-foreground" />
							</div>
							<h3 className="mb-1 font-semibold text-foreground">
								3. Make an impact
							</h3>
							<p className="text-sm leading-relaxed text-muted-foreground">
								Get matched, get started, and track your volunteer journey in
								one place.
							</p>
						</div>
					</div>
				</div>
			</section>
		</div>
	);
}
