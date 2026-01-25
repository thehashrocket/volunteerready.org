import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function Home() {
	return (
		<section className="mx-auto max-w-2xl space-y-6">
			<div className="space-y-2">
				<p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
					VolunteerMatch
				</p>
				<h1 className="text-3xl font-semibold tracking-tight">
					Connect volunteers with the missions that need them most.
				</h1>
				<p className="text-muted-foreground">
					This is a minimal layout to confirm Tailwind and shadcn/ui are wired
					correctly.
				</p>
			</div>
			<Card>
				<CardHeader>
					<CardTitle>Quick search</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<Input placeholder="Search by city or cause" />
					<Button>Find opportunities</Button>
				</CardContent>
			</Card>
		</section>
	);
}
