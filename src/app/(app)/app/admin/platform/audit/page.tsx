'use client';

import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { trpc } from '@/lib/trpc/client';

const ALL = '__all__';

export default function PlatformAuditPage() {
	const [action, setAction] = useState<string>(ALL);
	const [entityType, setEntityType] = useState<string>(ALL);
	const [orgId, setOrgId] = useState('');
	const [actorId, setActorId] = useState('');
	const [entityId, setEntityId] = useState('');
	const [dateFrom, setDateFrom] = useState('');
	const [dateTo, setDateTo] = useState('');
	const [impersonatedOnly, setImpersonatedOnly] = useState(false);
	const [cursor, setCursor] = useState<string | null>(null);
	const [rows, setRows] = useState<
		Array<
			NonNullable<ReturnType<typeof useQueryResult>['data']>['rows'][number]
		>
	>([]);
	const [expanded, setExpanded] = useState<Set<string>>(new Set());

	const options = trpc.platformAdmin.audit.options.useQuery();

	const filters = {
		action: action === ALL ? null : action,
		entityType: entityType === ALL ? null : entityType,
		orgId: orgId.trim() || null,
		actorId: actorId.trim() || null,
		entityId: entityId.trim() || null,
		dateFrom: dateFrom ? new Date(dateFrom) : null,
		dateTo: dateTo ? new Date(dateTo) : null,
		impersonatedOnly: impersonatedOnly || undefined,
	};

	const query = trpc.platformAdmin.audit.query.useQuery(
		{ filters, cursor, limit: 50 },
		{
			// Reset accumulator on new filter combo — key via filters hash below.
		},
	);

	function useQueryResult() {
		return query;
	}

	// Accumulate rows on "Load more"
	const allRows = cursor === null ? (query.data?.rows ?? []) : rows;

	function handleLoadMore() {
		if (!query.data?.nextCursor) return;
		setRows([...allRows, ...(query.data.rows ?? [])]);
		setCursor(query.data.nextCursor);
	}

	function resetFilters() {
		setAction(ALL);
		setEntityType(ALL);
		setOrgId('');
		setActorId('');
		setEntityId('');
		setDateFrom('');
		setDateTo('');
		setImpersonatedOnly(false);
		setCursor(null);
		setRows([]);
	}

	function toggleExpanded(id: string) {
		const next = new Set(expanded);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		setExpanded(next);
	}

	return (
		<div className="mx-auto max-w-6xl space-y-6 p-6">
			<PageHeader
				title="Audit log"
				description="Every actor, action, and entity across the platform."
			/>

			<Card className="space-y-3 p-4">
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					<Select
						value={action}
						onValueChange={(v) => {
							setAction(v);
							setCursor(null);
							setRows([]);
						}}
					>
						<SelectTrigger>
							<SelectValue placeholder="Action" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={ALL}>All actions</SelectItem>
							{options.data?.actions.map((a) => (
								<SelectItem key={a} value={a}>
									{a}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select
						value={entityType}
						onValueChange={(v) => {
							setEntityType(v);
							setCursor(null);
							setRows([]);
						}}
					>
						<SelectTrigger>
							<SelectValue placeholder="Entity type" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={ALL}>All entity types</SelectItem>
							{options.data?.entityTypes.map((t) => (
								<SelectItem key={t} value={t}>
									{t}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Input
						placeholder="Actor id"
						value={actorId}
						onChange={(e) => {
							setActorId(e.target.value);
							setCursor(null);
							setRows([]);
						}}
					/>

					<Input
						placeholder="Org id"
						value={orgId}
						onChange={(e) => {
							setOrgId(e.target.value);
							setCursor(null);
							setRows([]);
						}}
					/>

					<Input
						placeholder="Entity id"
						value={entityId}
						onChange={(e) => {
							setEntityId(e.target.value);
							setCursor(null);
							setRows([]);
						}}
					/>

					<div className="flex items-center gap-2">
						<Input
							type="date"
							value={dateFrom}
							onChange={(e) => {
								setDateFrom(e.target.value);
								setCursor(null);
								setRows([]);
							}}
						/>
						<Input
							type="date"
							value={dateTo}
							onChange={(e) => {
								setDateTo(e.target.value);
								setCursor(null);
								setRows([]);
							}}
						/>
					</div>
				</div>

				<div className="flex items-center justify-between">
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							checked={impersonatedOnly}
							onChange={(e) => {
								setImpersonatedOnly(e.target.checked);
								setCursor(null);
								setRows([]);
							}}
						/>
						Impersonated actions only
					</label>
					<Button variant="ghost" size="sm" onClick={resetFilters}>
						Reset
					</Button>
				</div>
			</Card>

			{query.isLoading && cursor === null ? (
				<div className="flex items-center justify-center py-12">
					<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
				</div>
			) : allRows.length === 0 ? (
				<Card className="p-6 text-sm text-muted-foreground">
					No audit entries match.
				</Card>
			) : (
				<Card className="divide-y">
					{allRows.map((row) => {
						const isExpanded = expanded.has(row.id);
						return (
							<div key={row.id} className="px-4 py-3 text-sm">
								<button
									type="button"
									className="flex w-full items-start gap-2 text-left"
									onClick={() => toggleExpanded(row.id)}
								>
									{isExpanded ? (
										<ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
									) : (
										<ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
									)}
									<div className="min-w-0 flex-1">
										<div className="flex flex-wrap items-center gap-2">
											<span className="font-medium">{row.action}</span>
											<span className="text-xs text-muted-foreground">
												{row.entityType}
												{row.entityId ? `:${row.entityId.slice(0, 12)}…` : ''}
											</span>
											{row.impersonatedBy && (
												<span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warning-foreground">
													impersonated
												</span>
											)}
										</div>
										<div className="mt-1 text-xs text-muted-foreground">
											{new Date(row.createdAt).toLocaleString()} ·{' '}
											{row.actor?.email ?? row.actorId ?? 'system'} ·{' '}
											{row.organization?.slug ?? '—'}
										</div>
									</div>
								</button>
								{isExpanded && (
									<pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">
										{JSON.stringify(row.metadata ?? {}, null, 2)}
									</pre>
								)}
							</div>
						);
					})}
				</Card>
			)}

			{query.data?.nextCursor && (
				<div className="flex justify-center">
					<Button variant="outline" onClick={handleLoadMore}>
						Load more
					</Button>
				</div>
			)}
		</div>
	);
}
