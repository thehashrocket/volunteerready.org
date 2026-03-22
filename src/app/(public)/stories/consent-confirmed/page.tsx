import { CheckCircle } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
	title: 'Consent Confirmed — VolunteerReady',
	description:
		'Thank you for agreeing to share your impact story on VolunteerReady.',
};

type Props = { searchParams: Promise<{ org?: string }> };

export default async function ConsentConfirmedPage({ searchParams }: Props) {
	const { org } = await searchParams;

	return (
		<div className="mx-auto max-w-md px-4 py-20" role="status">
			<CheckCircle className="mb-4 h-8 w-8 text-[#1B3C2A]" />
			<h2 className="font-display mb-3 text-2xl font-bold text-[#1B3C2A]">
				Thank you!
			</h2>
			<p className="mb-6 leading-relaxed text-[#3D3B38]">
				Thanks for agreeing to share your story! Your impact data will appear on
				our site, helping other nonprofits see what&apos;s possible with
				VolunteerReady.
			</p>
			{org && (
				<Link
					href={`/stories/${org}`}
					className="text-sm font-semibold text-[#1B3C2A] hover:underline"
				>
					See your story &rarr;
				</Link>
			)}
		</div>
	);
}
