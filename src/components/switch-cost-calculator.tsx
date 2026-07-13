'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';

const AVG_HOURLY_RATE = 25;
const MONTHLY_PRICE = 29;

export function SwitchCostCalculator() {
	const [volunteers, setVolunteers] = useState(50);
	const [hoursPerWeek, setHoursPerWeek] = useState(8);

	const annualCost = hoursPerWeek * 52 * AVG_HOURLY_RATE;
	const annualPlatform = MONTHLY_PRICE * 12;
	const savings = annualCost - annualPlatform;

	return (
		<Card className="border-border/70 bg-muted">
			<CardContent className="space-y-8 px-6 py-8 sm:px-8">
				<div>
					<div className="mb-3 flex items-baseline justify-between">
						<span className="text-sm font-semibold text-foreground">
							Active volunteers
						</span>
						<span className="font-display text-lg font-bold text-primary">
							{volunteers}
						</span>
					</div>
					<Slider
						value={[volunteers]}
						onValueChange={([v]) => setVolunteers(v)}
						min={10}
						max={500}
						step={10}
						className="py-1"
					/>
					<div className="mt-1 flex justify-between text-xs text-muted-foreground">
						<span>10</span>
						<span>500</span>
					</div>
				</div>

				<div>
					<div className="mb-3 flex items-baseline justify-between">
						<span className="text-sm font-semibold text-foreground">
							Hours/week on manual tracking
						</span>
						<span className="font-display text-lg font-bold text-primary">
							{hoursPerWeek}
						</span>
					</div>
					<Slider
						value={[hoursPerWeek]}
						onValueChange={([v]) => setHoursPerWeek(v)}
						min={1}
						max={20}
						step={1}
						className="py-1"
					/>
					<div className="mt-1 flex justify-between text-xs text-muted-foreground">
						<span>1 hr</span>
						<span>20 hrs</span>
					</div>
				</div>

				<div className="rounded-lg border border-primary/20 bg-card px-5 py-4">
					<p className="text-sm text-muted-foreground">
						You're spending roughly
					</p>
					<p className="font-display mt-1 text-3xl font-bold text-foreground">
						${annualCost.toLocaleString()}/year
					</p>
					<p className="mt-1 text-sm text-muted-foreground">
						on manual volunteer management
						<span className="text-xs">
							{' '}
							({hoursPerWeek} hrs × 52 weeks × ${AVG_HOURLY_RATE}/hr avg
							nonprofit admin wage)
						</span>
					</p>

					<div className="mt-4 border-t border-border/50 pt-4">
						<p className="text-sm font-semibold text-primary">
							VolunteerReady: ${MONTHLY_PRICE}/mo (${annualPlatform}/year)
						</p>
						{savings > 0 && (
							<p className="mt-1 text-sm text-muted-foreground">
								That's{' '}
								<span className="font-semibold text-success">
									${savings.toLocaleString()} back
								</span>{' '}
								in your budget every year.
							</p>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
