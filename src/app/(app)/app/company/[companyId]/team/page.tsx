'use client';

import {
	BarChart3,
	Building2,
	Clock,
	Download,
	FileText,
	ShieldCheck,
	Users,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { trpc } from '@/lib/trpc/client';

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
	label,
	value,
	icon: Icon,
	accent,
}: {
	label: string;
	value: string | number;
	icon: React.ComponentType<{ className?: string }>;
	accent: string;
}) {
	return (
		<Card className="overflow-hidden border-border/70">
			<div className={`h-1.5 ${accent}`} />
			<CardContent className="pb-5 pt-4">
				<div className="flex items-center gap-2 text-muted-foreground">
					<Icon className="h-4 w-4" />
					<span className="text-sm">{label}</span>
				</div>
				<div className="mt-2 text-3xl font-bold tabular-nums tracking-tight">
					{value}
				</div>
			</CardContent>
		</Card>
	);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ESGTeamDashboardPage() {
	const [from, setFrom] = useState('');
	const [to, setTo] = useState('');

	const companyQ = trpc.company.getCurrent.useQuery();
	const company = companyQ.data;
	const isPro = company?.planTier === 'PRO';

	const esgQ = trpc.esgReport.getSummary.useQuery(
		{
			from: from ? new Date(from) : undefined,
			to: to ? new Date(to) : undefined,
		},
		{ enabled: isPro },
	);

	const summary = esgQ.data;

	// Plan gate — non-PRO sees upgrade prompt
	if (companyQ.isLoading) {
		return (
			<div className="space-y-6">
				<Skeleton className="h-8 w-64" />
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					{Array.from({ length: 4 }).map((_, i) => (
						<Skeleton key={`skel-${i}`} className="h-28" />
					))}
				</div>
			</div>
		);
	}

	if (!isPro) {
		return (
			<div className="mx-auto max-w-lg py-16 text-center">
				<BarChart3 className="mx-auto h-12 w-12 text-muted-foreground" />
				<h2 className="mt-4 text-xl font-semibold">
					ESG Reporting requires a PRO plan
				</h2>
				<p className="mt-2 text-muted-foreground">
					Upgrade to PRO to access aggregate volunteer impact reports, CSV
					exports, and more.
				</p>
				<Button className="mt-6" asChild>
					<a href="/app/billing">Upgrade to PRO</a>
				</Button>
			</div>
		);
	}

	const buildExportParams = () => {
		const params = new URLSearchParams();
		if (company) params.set('companyId', company.id);
		if (from) params.set('from', from);
		if (to) params.set('to', to);
		return params.toString();
	};

	const handleExportCsv = () => {
		window.location.href = `/api/esg-report/csv?${buildExportParams()}`;
	};

	const handleExportPdf = () => {
		window.location.href = `/api/esg-report/pdf?${buildExportParams()}`;
	};

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">ESG Volunteer Impact</h1>
					<p className="text-muted-foreground">
						Aggregate volunteer activity across linked nonprofits
					</p>
				</div>
				<div className="flex gap-2">
					<Button
						variant="outline"
						onClick={handleExportCsv}
						disabled={esgQ.isLoading}
					>
						<Download className="mr-2 h-4 w-4" />
						Export CSV
					</Button>
					<Button
						variant="outline"
						onClick={handleExportPdf}
						disabled={esgQ.isLoading}
					>
						<FileText className="mr-2 h-4 w-4" />
						Export PDF
					</Button>
				</div>
			</div>

			{/* Date range filter */}
			<div className="flex flex-wrap items-end gap-4">
				<div className="space-y-1">
					<Label htmlFor="from">From</Label>
					<Input
						id="from"
						type="date"
						value={from}
						onChange={(e) => setFrom(e.target.value)}
						className="w-44"
					/>
				</div>
				<div className="space-y-1">
					<Label htmlFor="to">To</Label>
					<Input
						id="to"
						type="date"
						value={to}
						onChange={(e) => setTo(e.target.value)}
						className="w-44"
					/>
				</div>
				{(from || to) && (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							setFrom('');
							setTo('');
						}}
					>
						Clear
					</Button>
				)}
			</div>

			{/* Stat cards */}
			{esgQ.isLoading ? (
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					{Array.from({ length: 4 }).map((_, i) => (
						<Skeleton key={`stat-skel-${i}`} className="h-28" />
					))}
				</div>
			) : (
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					<StatCard
						label="Employees Active"
						value={summary?.totalEmployeesActive ?? 0}
						icon={Users}
						accent="bg-blue-500"
					/>
					<StatCard
						label="Organizations"
						value={summary?.totalOrgsSupported ?? 0}
						icon={Building2}
						accent="bg-green-500"
					/>
					<StatCard
						label="Shifts Completed"
						value={summary?.totalShifts ?? 0}
						icon={BarChart3}
						accent="bg-purple-500"
					/>
					<StatCard
						label="Total Hours"
						value={summary?.totalHours ?? 0}
						icon={Clock}
						accent="bg-orange-500"
					/>
				</div>
			)}

			{/* Per-org breakdown table */}
			{esgQ.isLoading ? (
				<Skeleton className="h-64" />
			) : summary && summary.rows.length > 0 ? (
				<Card>
					<CardContent className="p-0">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Organization</TableHead>
									<TableHead className="text-right">Employees</TableHead>
									<TableHead className="text-right">Shifts</TableHead>
									<TableHead className="text-right">Hours</TableHead>
									<TableHead className="text-right">Credentials</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{summary.rows.map((row) => (
									<TableRow key={row.orgId}>
										<TableCell className="font-medium">{row.orgName}</TableCell>
										<TableCell className="text-right tabular-nums">
											{row.employeeCount}
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{row.shiftCount}
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{Math.round(row.totalHours * 100) / 100}
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{row.verifiedCredentialCount}
										</TableCell>
									</TableRow>
								))}
								{/* Totals row */}
								<TableRow className="border-t-2 font-semibold">
									<TableCell>Total</TableCell>
									<TableCell className="text-right tabular-nums">
										{summary.totalEmployeesActive}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{summary.totalShifts}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{summary.totalHours}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{summary.totalVerifiedCredentials}
									</TableCell>
								</TableRow>
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			) : (
				<div className="rounded-lg border border-dashed p-12 text-center">
					<ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
					<h3 className="mt-4 font-semibold">
						No volunteer activity recorded yet
					</h3>
					<p className="mt-1 text-sm text-muted-foreground">
						Link a nonprofit to get started tracking employee volunteer impact.
					</p>
				</div>
			)}
		</div>
	);
}
