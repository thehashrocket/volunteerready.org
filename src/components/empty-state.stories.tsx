import type { Meta, StoryObj } from '@storybook/react';
import { FileText, Inbox, Search } from 'lucide-react';
import { EmptyState } from './empty-state';
import { Button } from './ui/button';

const meta: Meta<typeof EmptyState> = {
	title: 'Components/EmptyState',
	component: EmptyState,
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
	args: {
		title: 'No results found',
		description: 'Try adjusting your search or filters.',
		icon: Search,
	},
};

export const WithAction: Story = {
	args: {
		title: 'No applications yet',
		description: 'Applications will appear here once volunteers apply.',
		icon: Inbox,
		action: <Button size="sm">Create opportunity</Button>,
	},
};

export const Editorial: Story = {
	args: {
		title: 'Start your volunteer journey',
		description: 'Find opportunities that match your skills and passions.',
		icon: FileText,
		editorial: true,
		action: <Button size="sm">Browse opportunities</Button>,
	},
};
