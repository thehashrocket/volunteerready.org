import type { Metadata } from 'next';

export const metadata: Metadata = {
	title: 'Link Expired — VolunteerReady',
	description:
		'This consent link has expired. Contact us to receive a new one.',
};

export default function ConsentExpiredPage() {
	return (
		<div className="mx-auto max-w-md px-4 py-20">
			<h2 className="font-display mb-3 text-2xl font-bold text-[#252422]">
				This link has expired
			</h2>
			<p className="leading-relaxed text-[#3D3B38]">
				Consent links are valid for 7 days. Please email{' '}
				<a
					href="mailto:hello@volunteerready.org"
					className="font-semibold text-[#1B3C2A] hover:underline"
				>
					hello@volunteerready.org
				</a>{' '}
				and we&apos;ll send a fresh one.
			</p>
		</div>
	);
}
