'use client';

import { Check, X } from 'lucide-react';
import { FadeInOnScroll } from '@/components/fade-in-on-scroll';

type ComparisonItem = {
	before: string;
	after: string;
};

export function ComparisonTable({ items }: { items: ComparisonItem[] }) {
	return (
		<section className="bg-muted px-4 py-16">
			<div className="mx-auto max-w-3xl">
				<h2 className="font-display mb-10 text-center text-[32px] font-bold text-foreground [text-wrap:balance]">
					What changes
				</h2>

				{/* Desktop table */}
				<div className="hidden sm:block">
					<table className="w-full">
						<thead>
							<tr>
								<th
									scope="col"
									className="pb-4 text-left text-sm font-semibold text-muted-foreground"
								>
									Without VolunteerReady
								</th>
								<th
									scope="col"
									className="pb-4 text-left text-sm font-semibold text-primary"
								>
									With VolunteerReady
								</th>
							</tr>
						</thead>
						<tbody>
							{items.map((item) => (
								<tr key={item.before} className="border-b border-border/40">
									<td className="py-4 pr-6 align-top text-sm text-foreground">
										<span className="inline-flex items-start gap-2">
											<X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
											{item.before}
										</span>
									</td>
									<td className="py-4 align-top text-sm text-foreground">
										<span className="inline-flex items-start gap-2">
											<Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
											{item.after}
										</span>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{/* Mobile stacked layout */}
				<div className="space-y-6 sm:hidden">
					{items.map((item, i) => (
						<FadeInOnScroll key={item.before} delay={i * 75}>
							<div className="border-b border-border/40 pb-4">
								<div className="mb-2 flex items-start gap-2 text-sm text-muted-foreground">
									<X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
									{item.before}
								</div>
								<div className="flex items-start gap-2 text-sm text-foreground">
									<Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
									{item.after}
								</div>
							</div>
						</FadeInOnScroll>
					))}
				</div>
			</div>
		</section>
	);
}
