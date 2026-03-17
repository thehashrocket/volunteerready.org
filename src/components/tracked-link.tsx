'use client';

import { track } from '@vercel/analytics';
import Link from 'next/link';
import type { ComponentProps } from 'react';

type TrackedLinkProps = ComponentProps<typeof Link> & {
	/** Event name for analytics (defaults to "cta_click") */
	eventName?: string;
	/** Label shown in analytics dashboard */
	eventLabel: string;
	/** Page where the link lives */
	eventPage?: string;
};

export function TrackedLink({
	eventName = 'cta_click',
	eventLabel,
	eventPage,
	onClick,
	...props
}: TrackedLinkProps) {
	return (
		<Link
			{...props}
			onClick={(e) => {
				track(eventName, {
					label: eventLabel,
					page: eventPage ?? '',
					destination: typeof props.href === 'string' ? props.href : '',
				});
				onClick?.(e);
			}}
		/>
	);
}
