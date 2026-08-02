'use client';

import { FileUp, Laptop, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { safeCaughtErrorMessage } from '@/components/app/query-error-card';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/format-date';
import { trpc } from '@/lib/trpc/client';

function MobileGuard({ children }: { children: React.ReactNode }) {
	return (
		<>
			<div className="flex flex-col items-center gap-4 py-12 text-center md:hidden">
				<Laptop className="h-12 w-12 text-muted-foreground/50" />
				<p className="text-lg font-medium">Use a desktop browser</p>
				<p className="max-w-xs text-sm text-muted-foreground">
					CSV import works best on a larger screen. Please switch to a desktop
					or laptop to upload files.
				</p>
			</div>
			<div className="hidden md:block">{children}</div>
		</>
	);
}

export default function BulkImportPage() {
	const fileRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);
	const [result, setResult] = useState<{
		jobId: string;
		totalRows: number;
		parseErrors: number;
	} | null>(null);
	const [error, setError] = useState('');

	const startImport = trpc.bulkImport.start.useMutation();
	const jobsQuery = trpc.bulkImport.list.useQuery();
	const utils = trpc.useUtils();

	async function handleUpload() {
		const file = fileRef.current?.files?.[0];
		if (!file) return;

		setUploading(true);
		setError('');
		setResult(null);

		try {
			const text = await file.text();
			const res = await startImport.mutateAsync({
				fileName: file.name,
				csvContent: text,
			});
			setResult(res);
			utils.bulkImport.list.invalidate();
		} catch (err) {
			setError(safeCaughtErrorMessage(err) ?? 'Import failed.');
		} finally {
			setUploading(false);
			if (fileRef.current) fileRef.current.value = '';
		}
	}

	return (
		<div className="space-y-6">
			<PageHeader
				title="Bulk import volunteers"
				description="Upload a CSV file to create volunteer applications in bulk."
			/>

			<MobileGuard>
				{/* Upload card */}
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Upload CSV</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="rounded-lg border-2 border-dashed border-border/60 p-6 text-center">
							<FileUp className="mx-auto h-8 w-8 text-muted-foreground/50" />
							<p className="mt-2 text-sm text-muted-foreground">
								CSV with an <code className="font-mono text-xs">email</code>{' '}
								column (required). Optional:{' '}
								<code className="font-mono text-xs">opportunityId</code>.
							</p>
							<input
								ref={fileRef}
								type="file"
								accept=".csv,text/csv"
								className="mt-3 text-sm"
								onChange={() => {
									setError('');
									setResult(null);
								}}
							/>
						</div>

						<Button
							onClick={handleUpload}
							disabled={uploading}
							className="gap-2"
						>
							<Upload className="h-4 w-4" />
							{uploading ? 'Importing…' : 'Start import'}
						</Button>

						{error && (
							<p role="alert" className="text-sm text-destructive">
								{error}
							</p>
						)}

						{result && (
							<div className="rounded-lg border bg-muted/30 p-4 text-sm">
								<p className="font-medium text-primary">Import started</p>
								<p className="mt-1 text-muted-foreground">
									{result.totalRows} rows queued for processing.
									{result.parseErrors > 0 && (
										<span className="text-destructive">
											{' '}
											{result.parseErrors} rows had parse errors.
										</span>
									)}
								</p>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Recent imports */}
			</MobileGuard>
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Recent imports</CardTitle>
				</CardHeader>
				<CardContent>
					{jobsQuery.isLoading ? (
						<p className="text-sm text-muted-foreground">Loading…</p>
					) : !jobsQuery.data || jobsQuery.data.length === 0 ? (
						<p className="text-sm text-muted-foreground">No imports yet.</p>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b text-left text-muted-foreground">
										<th className="pb-2 pr-4 font-medium">File</th>
										<th className="pb-2 pr-4 font-medium">Status</th>
										<th className="pb-2 pr-4 font-medium">Rows</th>
										<th className="pb-2 pr-4 font-medium">Created</th>
										<th className="pb-2 pr-4 font-medium">Skipped</th>
										<th className="pb-2 font-medium">Date</th>
									</tr>
								</thead>
								<tbody>
									{jobsQuery.data.map((job) => (
										<tr key={job.id} className="border-b last:border-0">
											<td className="py-2 pr-4 font-medium">
												{job.fileName ?? '—'}
											</td>
											<td className="py-2 pr-4">
												<StatusBadge status={job.status} />
											</td>
											<td className="py-2 pr-4 tabular-nums">
												{job.processedRows}/{job.totalRows}
											</td>
											<td className="py-2 pr-4 tabular-nums">
												{job.createdRows}
											</td>
											<td className="py-2 pr-4 tabular-nums">
												{job.skippedRows}
											</td>
											<td className="py-2 text-muted-foreground">
												{formatDate(job.createdAt)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

function StatusBadge({ status }: { status: string }) {
	const colors: Record<string, string> = {
		PENDING: 'bg-muted text-muted-foreground',
		PROCESSING: 'bg-info/10 text-info-foreground',
		COMPLETED: 'bg-success/10 text-success-foreground',
		FAILED: 'bg-destructive/10 text-destructive',
	};

	return (
		<span
			className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? ''}`}
		>
			{status.toLowerCase()}
		</span>
	);
}
