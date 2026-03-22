interface FaqItem {
	question: string;
	answer: string;
}

export function JsonLdFaq({ faqs }: { faqs: FaqItem[] }) {
	const data = {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: faqs.map((faq) => ({
			'@type': 'Question',
			name: faq.question,
			acceptedAnswer: {
				'@type': 'Answer',
				text: faq.answer,
			},
		})),
	};

	return (
		<script
			type="application/ld+json"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data requires innerHTML
			dangerouslySetInnerHTML={{
				__html: JSON.stringify(data).replace(/</g, '\\u003c'),
			}}
		/>
	);
}
