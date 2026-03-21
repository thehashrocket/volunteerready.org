import { Mail } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
	title: 'Check your email',
};

export default function VerifyRequestPage() {
	return (
		<div className="grid min-h-[calc(100vh-3.5rem)] lg:grid-cols-[3fr_2fr]">
			{/* ── Left decorative panel (desktop only) ── */}
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
							"The best way to find yourself is to lose yourself in the service
							of others."
						</p>
					</blockquote>
					<p className="text-sm text-white/60">— Mahatma Gandhi</p>
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

			{/* ── Right content panel ── */}
			<div className="flex items-center justify-center bg-background px-6 py-16 lg:px-12">
				<div className="w-full max-w-sm space-y-8 text-center">
					<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
						<Mail className="h-8 w-8 text-primary" aria-hidden="true" />
					</div>

					<div className="space-y-2">
						<h1 className="font-display text-3xl font-bold text-foreground [text-wrap:balance]">
							Check your email
						</h1>
						<p className="text-sm text-muted-foreground">
							A sign-in link has been sent to your email address.
						</p>
					</div>

					<a
						href="/login"
						className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
					>
						Back to sign in
					</a>
				</div>
			</div>
		</div>
	);
}
