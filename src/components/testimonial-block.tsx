'use client';

import Link from 'next/link';

type TestimonialBlockProps = {
	quote: string;
	orgName: string;
	statLabel?: string;
	statValue?: string;
	storyUrl?: string;
};

export function TestimonialBlock({
	quote,
	orgName,
	statLabel,
	statValue,
	storyUrl,
}: TestimonialBlockProps) {
	return (
		<blockquote className="border-l-4 border-accent pl-4">
			<p className="text-base italic text-foreground md:text-lg">
				&ldquo;{quote}&rdquo;
			</p>
			<footer className="mt-3 flex flex-wrap items-center gap-3">
				<span className="text-sm font-bold text-foreground">{orgName}</span>
				{statLabel && statValue && (
					<span className="rounded-full bg-accent/15 px-3 py-0.5 text-sm text-muted-foreground">
						{statLabel}: {statValue}
					</span>
				)}
			</footer>
			{storyUrl && (
				<Link
					href={storyUrl}
					className="mt-2 inline-block text-sm font-semibold text-primary hover:underline"
				>
					Read their story &rarr;
				</Link>
			)}
		</blockquote>
	);
}
