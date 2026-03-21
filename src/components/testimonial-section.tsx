'use client';

import { useEffect, useState } from 'react';
import { TestimonialBlock } from '@/components/testimonial-block';

type Testimonial = {
	orgName: string;
	orgSlug: string;
	pullQuote: string;
	hoursPerWeek: number | null;
};

export function TestimonialSection() {
	const [testimonial, setTestimonial] = useState<Testimonial | null>(null);

	useEffect(() => {
		fetch('/api/trpc/caseStudy.getTestimonials', {
			method: 'GET',
			headers: { 'Content-Type': 'application/json' },
		})
			.then((res) => res.json())
			.then((data) => {
				const items = data?.result?.data?.json as Testimonial[] | undefined;
				if (items && items.length > 0) {
					// Random-on-mount selection
					const idx = Math.floor(Math.random() * items.length);
					setTestimonial(items[idx] ?? null);
				}
			})
			.catch((err) => {
				console.error('[testimonials] Failed to load testimonials', err);
			});
	}, []);

	if (!testimonial) return null;

	const statLabel = testimonial.hoursPerWeek ? 'Saved' : undefined;
	const statValue = testimonial.hoursPerWeek
		? `${Math.max(0, Math.round(testimonial.hoursPerWeek * 0.6))} hrs/week`
		: undefined;

	return (
		<section className="bg-[#F5F4F0] px-4 py-16">
			<div className="mx-auto max-w-2xl">
				<h2 className="font-display mb-6 text-2xl font-bold text-[#252422]">
					Trusted by nonprofits
				</h2>
				<TestimonialBlock
					quote={testimonial.pullQuote}
					orgName={testimonial.orgName}
					statLabel={statLabel}
					statValue={statValue}
					storyUrl={`/stories/${testimonial.orgSlug}`}
				/>
			</div>
		</section>
	);
}
