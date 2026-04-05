'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trpc } from '@/lib/trpc/client';

export default function NewCompanyPage() {
	const router = useRouter();
	const [name, setName] = useState('');

	const createMutation = trpc.company.create.useMutation({
		onSuccess: () => {
			toast.success('Company created!');
			router.refresh();
			router.push('/app/company');
		},
		onError: (err) => {
			toast.error(err.message ?? 'Failed to create company');
		},
	});

	return (
		<div className="max-w-md space-y-6">
			<div>
				<h1 className="font-sans text-2xl font-bold">
					Create a company account
				</h1>
				<p className="text-muted-foreground">
					Connect your company with nonprofits and manage CSR volunteering.
				</p>
			</div>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (name.trim().length >= 2) {
						createMutation.mutate({ name: name.trim() });
					}
				}}
				className="space-y-4"
			>
				<div className="space-y-2">
					<Label htmlFor="name">Company name</Label>
					<Input
						id="name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Acme Corp"
						minLength={2}
						maxLength={80}
						required
					/>
				</div>

				<Button
					type="submit"
					disabled={createMutation.isPending || name.trim().length < 2}
					className="w-full"
				>
					{createMutation.isPending ? 'Creating…' : 'Create company'}
				</Button>
			</form>
		</div>
	);
}
