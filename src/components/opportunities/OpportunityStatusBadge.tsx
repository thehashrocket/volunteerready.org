import { Archive, CheckCircle2, PenLine } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { OpportunityStatus } from '@/prisma/generated/client';

const statusConfig: Record<
	OpportunityStatus,
	{ label: string; icon: typeof PenLine; className: string }
> = {
	DRAFT: {
		label: 'Draft',
		icon: PenLine,
		className: 'border-stone-200 bg-stone-50 text-stone-700',
	},
	PUBLISHED: {
		label: 'Published',
		icon: CheckCircle2,
		className: 'border-green-200 bg-green-50 text-green-800',
	},
	CLOSED: {
		label: 'Closed',
		icon: Archive,
		className: 'border-slate-200 bg-slate-50 text-slate-600',
	},
};

export function OpportunityStatusBadge({
	status,
	className,
}: {
	status: OpportunityStatus;
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
