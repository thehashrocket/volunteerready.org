'use client';

import { Mail, ShieldCheck } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AuthFeedback } from '@/components/auth-feedback';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
	const [email, setEmail] = useState('');

	return (
		<div className="mx-auto flex min-h-[70vh] max-w-md items-center">
			<AuthFeedback />
			<Card className="w-full">
				<CardHeader>
					<div className="space-y-2">
						<p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
							VolunteerMatch
						</p>
						<h1 className="text-2xl font-semibold">Welcome back</h1>
						<p className="text-sm text-muted-foreground">
							Sign in to continue to your dashboard.
						</p>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<label className="text-sm font-medium" htmlFor="email">
							Email
						</label>
						<Input
							id="email"
							type="email"
							placeholder="you@organization.org"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
						/>
					</div>
				</CardContent>
				<CardFooter>
					<div className="space-y-3">
						<Button
							className="w-full"
							onClick={() =>
								signIn('google', { callbackUrl: '/app?auth=success' })
							}
						>
							<ShieldCheck className="mr-2 h-4 w-4" />
							Continue with Google
						</Button>
						<Button
							variant="outline"
							className="w-full"
							onClick={() => {
								void signIn('email', {
									email,
									callbackUrl: '/app',
								});
								toast.success('Check your email for a sign-in link.');
							}}
							disabled={!email}
						>
							<Mail className="mr-2 h-4 w-4" />
							Email me a sign-in link
						</Button>
					</div>
				</CardFooter>
			</Card>
		</div>
	);
}
