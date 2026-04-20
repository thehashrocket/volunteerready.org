'use client';

import { ChevronDown } from 'lucide-react';
import { FadeInOnScroll } from '@/components/fade-in-on-scroll';
import { JsonLdFaq } from '@/components/json-ld-faq';

export interface FaqItem {
	question: string;
	answer: string;
}

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
}

export function FaqSection({
	faqs,
	heading = 'Frequently asked questions',
}: {
	faqs: FaqItem[];
	heading?: string;
}) {
	return (
		<>
			<JsonLdFaq faqs={faqs} />
			<div className="mx-auto max-w-2xl">
				<h2 className="font-display mb-10 text-[32px] font-bold text-foreground [text-wrap:balance]">
					{heading}
				</h2>
				<div className="flex flex-col">
					{faqs.map((faq, i) => (
						<FadeInOnScroll key={faq.question} delay={i * 75}>
							<details
								id={slugify(faq.question)}
								className="border-b border-border/40 py-4"
								open={i === 0}
							>
								<summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between font-semibold text-foreground">
									{faq.question}
									<ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 [[open]>&]:rotate-180" />
								</summary>
								<p className="pb-1 pt-2 text-sm leading-relaxed text-muted-foreground">
									{faq.answer}
								</p>
							</details>
						</FadeInOnScroll>
					))}
				</div>
			</div>
		</>
	);
}
