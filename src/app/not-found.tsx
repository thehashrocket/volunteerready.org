import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
	return (
		<div className="flex min-h-[80vh] flex-col items-center justify-center bg-background px-4 text-center">
			<h1 className="font-display text-4xl font-bold text-primary md:text-5xl">
				Page not found
			</h1>
			<p className="mt-4 max-w-md text-lg text-muted-foreground">
				The page you&apos;re looking for doesn&apos;t exist or has been moved.
			</p>
			<div className="mt-8">
				<Button asChild>
					<Link href="/">Go home</Link>
				</Button>
			</div>
		</div>
	);
}
