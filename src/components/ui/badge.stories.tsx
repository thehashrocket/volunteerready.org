import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './badge';

const meta: Meta<typeof Badge> = {
	title: 'UI/Badge',
	component: Badge,
	argTypes: {
		variant: {
			control: 'select',
			options: [
				'default',
				'secondary',
				'destructive',
				'outline',
				'success',
				'warning',
				'info',
				'neutral',
				'pending',
			],
		},
	},
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
	args: { children: 'Badge', variant: 'default' },
};

export const Success: Story = {
	args: { children: 'Approved', variant: 'success' },
};

export const Warning: Story = {
	args: { children: 'Needs Review', variant: 'warning' },
};

export const Info: Story = {
	args: { children: 'New', variant: 'info' },
};

export const Pending: Story = {
	args: { children: 'Pending', variant: 'pending' },
};

export const Destructive: Story = {
	args: { children: 'Rejected', variant: 'destructive' },
};

export const Neutral: Story = {
	args: { children: 'Draft', variant: 'neutral' },
};

export const Outline: Story = {
	args: { children: 'v1.0.0', variant: 'outline' },
};

export const AllVariants: Story = {
	render: () => (
		<div className="flex flex-wrap gap-2">
			<Badge variant="default">Default</Badge>
			<Badge variant="secondary">Secondary</Badge>
			<Badge variant="destructive">Destructive</Badge>
			<Badge variant="outline">Outline</Badge>
			<Badge variant="success">Success</Badge>
			<Badge variant="warning">Warning</Badge>
			<Badge variant="info">Info</Badge>
			<Badge variant="neutral">Neutral</Badge>
			<Badge variant="pending">Pending</Badge>
		</div>
	),
};
