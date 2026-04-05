'use client';

import { Copy, Download, ExternalLink, Mail } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { trpc } from '@/lib/trpc/client';
import type { CaseStudyData } from '@/server/domain/case-study';
import { renderMarkdown } from '@/server/domain/case-study';

export default function AdminCaseStudiesPage() {
	const utils = trpc.useUtils();
	const { data, isLoading, error } =
		trpc.caseStudy.getAllOrgsForCaseStudies.useQuery();

	const setConsent = trpc.caseStudy.setConsent.useMutation({
		onSuccess: () => utils.caseStudy.getAllOrgsForCaseStudies.invalidate(),
	});
	const sendEmail = trpc.caseStudy.sendApprovalEmail.useMutation();

	if (isLoading) {
		return (
			<div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
				<h1 className="font-sans text-2xl font-bold text-foreground">
					Case Studies
				</h1>
				{[1, 2, 3].map((i) => (
					<Skeleton key={i} className="h-48 w-full rounded-lg" />
				))}
			</div>
		);
	}

	if (error) {
		return (
			<div className="mx-auto max-w-3xl px-4 py-8">
				<h1 className="font-sans mb-4 text-2xl font-bold text-foreground">
					Case Studies
				</h1>
				<p className="text-muted-foreground">Failed to load case studies.</p>
				<Button
					variant="outline"
					size="sm"
					className="mt-2"
					onClick={() => utils.caseStudy.getAllOrgsForCaseStudies.invalidate()}
				>
					Retry
				</Button>
			</div>
		);
	}

	const studies = data ?? [];

	return (
		<div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
			<h1 className="font-sans text-2xl font-bold text-foreground">
				Case Studies
			</h1>

			{studies.length === 0 && (
				<p className="text-muted-foreground">
					No orgs available yet. Once concierge orgs have usage data, their
					stories will appear here. Send approval emails from each card to
					request consent.
				</p>
			)}

			{studies.map((study) => (
				<CaseStudyCard
					key={study.orgId}
					study={study}
					onToggleConsent={(consent) =>
						setConsent.mutate(
							{ orgId: study.orgId, consent },
							{
								onError: () => toast.error('Failed to update consent'),
							},
						)
					}
					onSendEmail={() =>
						sendEmail.mutate(
							{ orgId: study.orgId },
							{
								onSuccess: (result) => {
									if (result.sent) {
										toast.success(`Sent to ${result.to}`);
									} else {
										toast.error('Failed to send email');
									}
								},
								onError: () => toast.error('Failed to send email'),
							},
						)
					}
					isSendingEmail={sendEmail.isPending}
				/>
			))}
		</div>
	);
}

function CaseStudyCard({
	study,
	onToggleConsent,
	onSendEmail,
	isSendingEmail,
}: {
	study: CaseStudyData;
	onToggleConsent: (consent: boolean) => void;
	onSendEmail: () => void;
	isSendingEmail: boolean;
}) {
	const handleCopyMarkdown = () => {
		const md = renderMarkdown(study);
		navigator.clipboard.writeText(md);
		toast.success('Markdown copied');
	};

	const handleDownloadPdf = () => {
		window.open(`/api/case-study/pdf?orgId=${study.orgId}`, '_blank');
	};

	return (
		<article
			aria-label={`${study.orgName} case study`}
			className="rounded-lg border-l-4 border-accent bg-muted p-6"
		>
			<div className="flex items-start gap-3">
				{study.logoUrl && (
					<Image
						src={study.logoUrl}
						alt=""
						width={32}
						height={32}
						className="h-8 w-8 rounded object-contain"
						unoptimized
					/>
				)}
				<div className="flex-1">
					<h3 className="font-sans text-lg font-bold text-foreground">
						{study.orgName}
					</h3>
					<p className="text-sm text-muted-foreground">
						Joined {study.daysOnPlatform} days ago
					</p>
				</div>
			</div>

			{study.pullQuote && (
				<blockquote className="mt-4 border-l-4 border-accent pl-3 text-sm italic text-muted-foreground">
					&ldquo;{study.pullQuote}&rdquo;
				</blockquote>
			)}

			<div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
				<span>
					<strong>{study.summary.applicationsSubmitted}</strong> applications
				</span>
				<span>
					<strong>{study.summary.applicationsApproved}</strong> approved
				</span>
				<span>
					<strong>{study.summary.backgroundChecksCompleted}</strong> BG checks
				</span>
				<span>
					<strong>{study.summary.credentialsIssued}</strong> credentials
				</span>
			</div>

			<div className="mt-4 flex flex-wrap gap-2">
				<Button
					variant="outline"
					size="sm"
					className="rounded-full"
					onClick={handleDownloadPdf}
					aria-label={`Download PDF for ${study.orgName}`}
				>
					<Download className="mr-1.5 h-3.5 w-3.5" />
					Download PDF
				</Button>
				<Button
					variant="outline"
					size="sm"
					className="rounded-full"
					onClick={handleCopyMarkdown}
				>
					<Copy className="mr-1.5 h-3.5 w-3.5" />
					Copy MD
				</Button>
				<Button
					variant="outline"
					size="sm"
					className="rounded-full"
					onClick={onSendEmail}
					disabled={isSendingEmail}
				>
					<Mail className="mr-1.5 h-3.5 w-3.5" />
					{isSendingEmail ? 'Sending...' : 'Send Approval Email'}
				</Button>
				{study.consentToPublicize && (
					<Button variant="outline" size="sm" className="rounded-full" asChild>
						<a
							href={`/stories/${study.orgSlug}`}
							target="_blank"
							rel="noopener noreferrer"
						>
							<ExternalLink className="mr-1.5 h-3.5 w-3.5" />
							View Public Page
						</a>
					</Button>
				)}
			</div>

			<div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
				<Switch
					checked={study.consentToPublicize}
					onCheckedChange={onToggleConsent}
					aria-checked={study.consentToPublicize}
				/>
				<span className="text-sm text-muted-foreground">
					{study.consentToPublicize ? 'Consent granted' : 'No consent yet'}
				</span>
			</div>
		</article>
	);
}
