import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ApplicationStatus } from '@/prisma/generated/client';

const statusConfig: Record<
	ApplicationStatus,
	{ label: string; icon: typeof Clock; variant: BadgeProps['variant'] }
> = {
	SUBMITTED: {
		label: 'Submitted',
		icon: Clock,
		variant: 'info',
	},
	REVIEW: {
		label: 'In review',
		icon: AlertCircle,
		variant: 'warning',
	},
	APPROVED: {
		label: 'Approved',
		icon: CheckCircle2,
		variant: 'success',
	},
	REJECTED: {
		label: 'Rejected',
		icon: XCircle,
		variant: 'destructive',
	},
};

export function ApplicationStatusBadge({
	status,
	className,
}: {
	status: ApplicationStatus;
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
