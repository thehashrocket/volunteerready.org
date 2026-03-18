import type { Metadata } from 'next';
import { AnalyticsClient } from './_components/analytics-client';

export const metadata: Metadata = {
	title: 'Analytics',
	description:
		'Volunteer engagement metrics, application funnel, and shift fill rates for your organization.',
};

export default function AnalyticsPage() {
	return <AnalyticsClient />;
}
