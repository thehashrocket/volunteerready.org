import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ApplicationStatus } from '@/prisma/generated/client';

const statusConfig: Record<
	ApplicationStatus,
	{ label: string; icon: typeof Clock; className: string }
> = {
	SUBMITTED: {
		label: 'Submitted',
		icon: Clock,
		className: 'border-blue-200 bg-blue-50 text-blue-800',
	},
	REVIEW: {
		label: 'In review',
		icon: AlertCircle,
		className: 'border-amber-200 bg-amber-50 text-amber-900',
	},
	APPROVED: {
		label: 'Approved',
		icon: CheckCircle2,
		className: 'border-emerald-200 bg-emerald-50 text-emerald-900',
	},
	REJECTED: {
		label: 'Rejected',
		icon: XCircle,
		className: 'border-rose-200 bg-rose-50 text-rose-900',
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
		<Badge className={cn(config.className, className)}>
			<Icon className="h-3.5 w-3.5" />
			{config.label}
		</Badge>
	);
}
