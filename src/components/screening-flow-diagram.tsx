'use client';

import {
	ArrowRight,
	CheckCircle,
	ClipboardList,
	Search,
	UserPlus,
} from 'lucide-react';
import { FadeInOnScroll } from '@/components/fade-in-on-scroll';

const steps = [
	{
		icon: UserPlus,
		label: 'Volunteer applies',
		detail: 'Online form, any device',
	},
	{
		icon: ClipboardList,
		label: 'Screener auto-evaluates',
		detail: 'Custom pass/fail rules',
	},
	{
		icon: Search,
		label: 'Background check runs',
		detail: 'FCRA-compliant, automated',
	},
	{
		icon: CheckCircle,
		label: 'Cleared to serve',
		detail: 'Credential issued instantly',
	},
];

export function ScreeningFlowDiagram() {
	return (
		<section className="px-4 py-16">
			<div className="mx-auto max-w-3xl">
				<h2 className="font-display mb-10 text-center text-[32px] font-bold text-foreground [text-wrap:balance]">
					How screening works
				</h2>

				{/* Desktop: horizontal flow */}
				<div className="hidden sm:flex sm:items-start sm:justify-between sm:gap-2">
					{steps.map((step, i) => {
						const Icon = step.icon;
						return (
							<FadeInOnScroll key={step.label} delay={i * 100}>
								<div className="flex items-start gap-2">
									<div className="flex flex-col items-center text-center">
										<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
											<Icon className="h-6 w-6 text-primary" />
										</div>
										<p className="mt-3 text-sm font-semibold text-foreground">
											{step.label}
										</p>
										<p className="mt-1 text-xs text-muted-foreground">
											{step.detail}
										</p>
									</div>
									{i < steps.length - 1 && (
										<ArrowRight className="mt-3 h-5 w-5 shrink-0 text-muted-foreground/50" />
									)}
								</div>
							</FadeInOnScroll>
						);
					})}
				</div>

				{/* Mobile: vertical list */}
				<ol className="space-y-6 sm:hidden">
					{steps.map((step, i) => {
						const Icon = step.icon;
						return (
							<FadeInOnScroll key={step.label} delay={i * 75}>
								<li className="flex items-start gap-4">
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
										<Icon className="h-5 w-5 text-primary" />
									</div>
									<div>
										<p className="font-semibold text-foreground">
											<span className="mr-2 text-muted-foreground">
												{i + 1}.
											</span>
											{step.label}
										</p>
										<p className="mt-0.5 text-sm text-muted-foreground">
											{step.detail}
										</p>
									</div>
								</li>
							</FadeInOnScroll>
						);
					})}
				</ol>
			</div>
		</section>
	);
}
