'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trpc } from '@/lib/trpc/client';

export default function StatusClient({ token }: { token: string | null }) {
	const [email, setEmail] = useState('');

	const request = trpc.status.requestLink.useMutation({
		onSuccess: () => {
			toast.success('If we found a match, we emailed you a secure link.');
		},
		onError: (err) => {
			toast.error(err.message ?? 'Could not send link');
		},
	});

	const statusQ = trpc.status.getByToken.useQuery(
		{ token: token ?? '' },
		{ enabled: Boolean(token) },
	);

	if (token) {
		if (statusQ.isLoading) {
			return (
				<Card>
					<CardHeader>
						<CardTitle>Loading…</CardTitle>
					</CardHeader>
					<CardContent>Checking your link…</CardContent>
				</Card>
			);
		}

		if (statusQ.error) {
			return (
				<Card>
					<CardHeader>
						<CardTitle>Link issue</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<p className="text-muted-foreground">{statusQ.error.message}</p>
						<p className="text-muted-foreground">Request a new link below.</p>
						<RequestForm />
					</CardContent>
				</Card>
			);
		}

		const data = statusQ.data;
		if (!data) {
			return (
				<Card>
					<CardHeader>
						<CardTitle>Status unavailable</CardTitle>
					</CardHeader>
					<CardContent>
						We could not load your status. Please request a new link.
					</CardContent>
				</Card>
			);
		}
		return (
			<Card>
				<CardHeader>
					<CardTitle>Status results</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="text-sm text-muted-foreground">
						Showing results for{' '}
						<span className="font-medium text-foreground">{data.email}</span>
					</div>

					{data.applications.length === 0 ? (
						<p className="text-muted-foreground">
							We couldn’t find any applications for that email.
						</p>
					) : (
						<div className="space-y-3">
							{data.applications.map((a) => (
								<div key={a.id} className="rounded-md border p-3 text-sm">
									<div className="font-medium">{a.orgName}</div>
									<div className="text-muted-foreground">
										Submitted: {new Date(a.submittedAt).toLocaleString()}
									</div>
									<div className="mt-2 flex gap-2">
										<span className="rounded bg-muted px-2 py-1">
											App: {a.status}
										</span>
										<span className="rounded bg-muted px-2 py-1">
											Screening: {a.screeningStatus}
										</span>
									</div>
									<div className="mt-2 text-muted-foreground">
										Next steps: If you’re a match, the rescue will contact you
										by email.
									</div>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>
		);
	}

	return <RequestForm />;

	function RequestForm() {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Email me a status link</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="email">Email</Label>
						<Input
							id="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="you@example.com"
							autoComplete="email"
						/>
					</div>

					<Button
						onClick={() => request.mutate({ email })}
						disabled={request.isPending || email.length < 3}
					>
						{request.isPending ? 'Sending…' : 'Send link'}
					</Button>

					<p className="text-xs text-muted-foreground">
						We’ll send a one-time link (expires in 30 minutes). If you didn’t
						apply, you can ignore it.
					</p>
				</CardContent>
			</Card>
		);
	}
}
