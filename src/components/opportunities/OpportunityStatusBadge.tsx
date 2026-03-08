import { Archive, CheckCircle2, PenLine } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { OpportunityStatus } from '@/prisma/generated/client';

const statusConfig: Record<
	OpportunityStatus,
	{ label: string; icon: typeof PenLine; variant: BadgeProps['variant'] }
> = {
	DRAFT: {
		label: 'Draft',
		icon: PenLine,
		variant: 'neutral',
	},
	PUBLISHED: {
		label: 'Published',
		icon: CheckCircle2,
		variant: 'success',
	},
	CLOSED: {
		label: 'Closed',
		icon: Archive,
		variant: 'secondary',
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
		<Badge variant={config.variant} className={cn(className)}>
			<Icon className="h-3.5 w-3.5" />
			{config.label}
		</Badge>
	);
}
