import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from './card';

const meta: Meta<typeof Card> = {
	title: 'UI/Card',
	component: Card,
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
	render: () => (
		<Card className="w-[350px]">
			<CardHeader>
				<CardTitle>Card Title</CardTitle>
				<CardDescription>Card description goes here.</CardDescription>
			</CardHeader>
			<CardContent>
				<p className="text-sm text-muted-foreground">
					Card content with some helpful information.
				</p>
			</CardContent>
			<CardFooter>
				<Button size="sm">Action</Button>
			</CardFooter>
		</Card>
	),
};

export const Simple: Story = {
	render: () => (
		<Card className="w-[350px]">
			<CardContent>
				<p className="text-sm">Simple card with just content.</p>
			</CardContent>
		</Card>
	),
};
