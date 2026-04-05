import type { Meta, StoryObj } from '@storybook/react';
import { Mail } from 'lucide-react';
import { Button } from './button';

const meta: Meta<typeof Button> = {
	title: 'UI/Button',
	component: Button,
	argTypes: {
		variant: {
			control: 'select',
			options: [
				'default',
				'destructive',
				'outline',
				'secondary',
				'ghost',
				'link',
			],
		},
		size: {
			control: 'select',
			options: ['default', 'xs', 'sm', 'lg', 'icon'],
		},
	},
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
	args: { children: 'Button', variant: 'default' },
};

export const Secondary: Story = {
	args: { children: 'Secondary', variant: 'secondary' },
};

export const Destructive: Story = {
	args: { children: 'Delete', variant: 'destructive' },
};

export const Outline: Story = {
	args: { children: 'Outline', variant: 'outline' },
};

export const Ghost: Story = {
	args: { children: 'Ghost', variant: 'ghost' },
};

export const Link: Story = {
	args: { children: 'Link', variant: 'link' },
};

export const WithIcon: Story = {
	args: {
		children: (
			<>
				<Mail /> Send Email
			</>
		),
		variant: 'default',
	},
};

export const Small: Story = {
	args: { children: 'Small', size: 'sm' },
};

export const Large: Story = {
	args: { children: 'Large', size: 'lg' },
};

export const Disabled: Story = {
	args: { children: 'Disabled', disabled: true },
};
