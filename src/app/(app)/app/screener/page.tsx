import { PageHeader } from '@/components/page-header';
import { QuestionsClient } from './QuestionsClient';

export default function ScreenerPage() {
	return (
		<div className="space-y-8">
			<PageHeader
				title="Screener Questions"
				description="Configure the questions volunteers answer when applying."
			/>
			<QuestionsClient />
		</div>
	);
}
