import type { ReactNode } from 'react';

interface PageHeaderProps {
	title: string;
	description?: string;
	actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
	return (
		<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div className="min-w-0">
				<h1 className="font-sans text-2xl font-semibold tracking-tight">
					{title}
				</h1>
				{description ? (
					<p className="text-sm text-muted-foreground">{description}</p>
				) : null}
			</div>
			{/* `min-w-0` + `flex-wrap` for the same reason the app-shell top bar
			    needed them: a flex item's default `min-width: auto` is its content's
			    intrinsic width, so an actions row wider than the column forces
			    itself wider than its own parent rather than reflowing. On
			    `/app/opportunities` at 375px that put a `w-44` Select beside a
			    "New opportunity" button — 343px of content in a 311px column — and
			    the row ran 32px past the page padding to sit flush against the
			    viewport edge. It did not even trip a `documentElement.scrollWidth`
			    assertion, because the overhang happened to stop exactly at 375;
			    one more character in the label and it would have. */}
			{actions ? (
				<div className="flex min-w-0 flex-wrap items-center gap-2">
					{actions}
				</div>
			) : null}
		</div>
	);
}
