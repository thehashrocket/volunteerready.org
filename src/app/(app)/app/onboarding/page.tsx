import { PageHeader } from '@/components/page-header';
import { CreateOrgForm } from './CreateOrgForm';

export default function OnboardingPage() {
	return (
		<div className="mx-auto max-w-lg space-y-8">
			<PageHeader
				title="Create your organization"
				description="You'll be the owner and can invite teammates after setup."
			/>
			<CreateOrgForm />
		</div>
	);
}
