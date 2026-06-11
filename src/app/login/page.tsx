'use client';

import { Mail, ShieldCheck } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';
import { AuthFeedback } from '@/components/auth-feedback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
	const [email, setEmail] = useState('');

	return (
		<div className="grid min-h-[calc(100vh-3.5rem)] lg:grid-cols-[3fr_2fr]">
			{/* ââ Left decorative panel (desktop only) ââ */}
			<div
				aria-hidden="true"
				className="relative hidden overflow-hidden bg-primary lg:flex lg:flex-col lg:justify-between lg:p-12"
			>
				{/* Logo */}
				<div className="relative z-10 flex items-center gap-2.5">
					<div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/15 text-sm font-bold text-white">
						V
					</div>
					<span className="font-semibold tracking-tight text-white/90">
						VolunteerReady
					</span>
				</div>

				{/* Quote */}
				<div className="relative z-10 space-y-6">
					<blockquote>
						<p className="font-display text-4xl font-bold italic leading-snug text-white">
							“The best way to find yourself is to lose yourself in the service
							of others.”
						</p>
					</blockquote>
					<p className="text-sm text-white/60">â Mahatma Gandhi</p>
					<p className="max-w-sm text-base leading-relaxed text-white/80">
						Join thousands of volunteers making a difference in their
						communities. Every application you submit, every hour you give,
						matters.
					</p>
				</div>

				{/* Footer */}
				<div className="relative z-10">
					<p className="text-xs text-white/40">
						Connecting volunteers with nonprofits since 2024.
					</p>
				</div>
			</div>

			{/* ââ Right form panel ââ */}
			<div className="flex items-center justify-center bg-background px-6 py-16 lg:px-12">
				<div className="w-full max-w-sm space-y-8">
					<Suspense fallback={null}>
						<AuthFeedback />
					</Suspense>

					<div className="space-y-1.5">
						<p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
							Welcome back
						</p>
						<h1 className="font-display text-3xl font-bold text-foreground">
							Sign in to continue
						</h1>
						<p className="text-sm text-muted-foreground">
							Track your applications or manage your organization.
						</p>
					</div>

					<div className="space-y-2">
						<label
							className="text-sm font-medium text-foreground"
							htmlFor="email"
						>
							Email address
						</label>
						<Input
							id="email"
							type="email"
							placeholder="you@organization.org"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							className="h-11"
						/>
					</div>

					<div className="space-y-3">
						<Button
							className="h-11 w-full rounded-lg"
							onClick={() =>
								signIn('google', { callbackUrl: '/app?auth=success' })
							}
						>
							<ShieldCheck className="h-4 w-4" />
							Continue with Google
						</Button>
						<Button
							variant="outline"
							className="h-11 w-full rounded-lg"
							onClick={() => {
								void signIn('email', {
									email,
									callbackUrl: '/app',
								});
								toast.success('Check your email for a sign-in link.');
							}}
							disabled={!email}
						>
							<Mail className="h-4 w-4" />
							Email me a sign-in link
						</Button>
					</div>

					<p className="text-center text-xs text-muted-foreground">
						New here?{' '}
						<a
							href="/login?callbackUrl=/app/onboarding"
							className="font-medium text-primary underline-offset-4 hover:underline"
						>
							Create your organization
						</a>
					</p>
				</div>
			</div>
		</div>
	);
}
