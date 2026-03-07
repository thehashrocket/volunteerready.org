'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z.object({
	name: z
		.string()
		.min(2, 'Organization name must be at least 2 characters')
		.max(100, 'Organization name must be 100 characters or fewer')
		.trim(),
});

type FormValues = z.infer<typeof schema>;

export function CreateOrgForm() {
	const router = useRouter();
	const qc = useQueryClient();

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<FormValues>({
		resolver: zodResolver(schema),
		mode: 'onSubmit',
	});

	const mutation = trpc.onboarding.createOrg.useMutation({
		onSuccess: async () => {
			toast.success('Organization created.');
			await qc.invalidateQueries();
			router.push('/app');
		},
		onError: (err) => {
			toast.error(err.message ?? 'Failed to create organization.');
		},
	});

	function onSubmit(values: FormValues) {
		mutation.mutate({ name: values.name });
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Organization details</CardTitle>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
					<div className="space-y-2">
						<Label htmlFor="name">Organization name</Label>
						<Input
							id="name"
							placeholder="e.g. Paws & Claws Rescue"
							autoComplete="organization"
							{...register('name')}
						/>
						{errors?.name?.message ? (
							<p className="text-sm text-destructive">{errors.name.message}</p>
						) : null}
					</div>

					<Button
						type="submit"
						disabled={mutation.isPending}
						className="w-full"
					>
						{mutation.isPending ? 'Creating…' : 'Create organization'}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
