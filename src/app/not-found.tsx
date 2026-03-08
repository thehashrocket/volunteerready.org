import { FileQuestion } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function NotFound() {
	return (
		<div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4">
			<Card className="w-full max-w-md">
				<CardContent className="pt-6 text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
						<FileQuestion className="h-6 w-6 text-muted-foreground" />
					</div>
					<h2 className="text-lg font-semibold">Page not found</h2>
					<p className="mt-2 text-sm text-muted-foreground">
						The page you&apos;re looking for doesn&apos;t exist or has been
						moved.
					</p>
					<div className="mt-6 flex justify-center">
						<Button asChild size="sm">
							<Link href="/">Go home</Link>
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
