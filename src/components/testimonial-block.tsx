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
		<blockquote className="border-l-4 border-[#C4A882] pl-4">
			<p className="text-base italic text-[#252422] md:text-lg">
				&ldquo;{quote}&rdquo;
			</p>
			<footer className="mt-3 flex flex-wrap items-center gap-3">
				<span className="text-sm font-bold text-[#252422]">{orgName}</span>
				{statLabel && statValue && (
					<span className="rounded-full bg-[rgba(196,168,130,0.15)] px-3 py-0.5 text-sm text-[#3D3B38]">
						{statLabel}: {statValue}
					</span>
				)}
			</footer>
			{storyUrl && (
				<Link
					href={storyUrl}
					className="mt-2 inline-block text-sm font-semibold text-[#1B3C2A] hover:underline"
				>
					Read their story &rarr;
				</Link>
			)}
		</blockquote>
	);
}
