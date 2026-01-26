import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ScreeningStatus } from '@/prisma/generated/client';

const statusConfig: Record<
	ScreeningStatus,
	{ label: string; icon: typeof CheckCircle2; className: string }
> = {
	PASS: {
		label: 'Pass',
		icon: CheckCircle2,
		className: 'border-emerald-200 bg-emerald-50 text-emerald-900',
	},
	REVIEW: {
		label: 'Needs review',
		icon: AlertTriangle,
		className: 'border-amber-200 bg-amber-50 text-amber-900',
	},
	FAIL: {
		label: 'Fail',
		icon: XCircle,
		className: 'border-rose-200 bg-rose-50 text-rose-900',
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
		<Badge className={cn(config.className, className)}>
			<Icon className="h-3.5 w-3.5" />
			{config.label}
		</Badge>
	);
}
