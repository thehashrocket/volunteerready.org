import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ScreeningStatus } from '@/prisma/generated/client';

const statusConfig: Record<
	ScreeningStatus,
	{ label: string; icon: typeof CheckCircle2; variant: BadgeProps['variant'] }
> = {
	PASS: {
		label: 'Pass',
		icon: CheckCircle2,
		variant: 'success',
	},
	REVIEW: {
		label: 'Needs review',
		icon: AlertTriangle,
		variant: 'warning',
	},
	FAIL: {
		label: 'Fail',
		icon: XCircle,
		variant: 'destructive',
	},
};

export function ScreeningStatusBadge({
	status,
	className,
}: {
	status: ScreeningStatus;
	className?: string;
}) {
	const config = statusConfig[status];
	const Icon = config.icon;

	return (
		<Badge variant={config.variant} className={cn(className)}>
			<Icon className="h-3.5 w-3.5" />
			{config.label}
		</Badge>
	);
}
