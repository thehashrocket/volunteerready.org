'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const CYCLE = ['light', 'dark', 'system'] as const;

export function ThemeToggle() {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => setMounted(true), []);

	if (!mounted) {
		return <Skeleton className="h-8 w-8 rounded-full" />;
	}

	const currentIndex = CYCLE.indexOf(theme as (typeof CYCLE)[number]);
	const nextTheme = CYCLE[(currentIndex + 1) % CYCLE.length];

	const icon =
		theme === 'dark' ? (
			<Moon className="h-4 w-4" />
		) : theme === 'system' ? (
			<Monitor className="h-4 w-4" />
		) : (
			<Sun className="h-4 w-4" />
		);

	const label =
		theme === 'dark'
			? 'Dark mode — switch to system'
			: theme === 'system'
				? 'System mode — switch to light'
				: 'Light mode — switch to dark';

	return (
		<Button
			variant="ghost"
			size="icon"
			className="h-8 w-8"
			role="switch"
			aria-checked={theme === 'dark'}
			aria-label={label}
			onClick={() => setTheme(nextTheme)}
			onKeyDown={(e) => {
				if (e.key === ' ') {
					e.preventDefault();
					setTheme(nextTheme);
				}
			}}
		>
			{icon}
		</Button>
	);
}
