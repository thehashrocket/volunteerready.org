'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Check, Copy, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { safeErrorMessage } from '@/components/app/query-error-card';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BASE_URL } from '@/lib/constants';
import { useMediaQuery } from '@/lib/hooks/use-media-query';
import { trpc } from '@/lib/trpc/client';
import {
	normalizeSlugInput,
	type OrgProfileUpdateInput,
	orgProfileUpdateSchema,
	orgSlugSchema,
} from '@/server/domain/org-profile';

const APPLY_URL_PREFIX = `${new URL(BASE_URL).host.replace(/^www\./, '')}/apply/`;

/**
 * Org profile editor (issue #127, decisions 4A/6A/7B/8A/14A).
 *
 * Form lifecycle (6A):
 *   pristine (Save disabled) → dirty → [slug changed? confirm dialog] →
 *   in-flight → success toast (+ new-URL moment on slug change) | inline error
 *
 * Unsaved-changes guard (7B): while dirty, internal link clicks (sidebar,
 * Access & setup rows — any <a>) require confirmation, and beforeunload
 * covers tab close / external navigation.
 */
export function OrgProfileForm({
	initialName,
	initialSlug,
	canEdit,
}: {
	initialName: string;
	initialSlug: string;
	canEdit: boolean;
}) {
	const [savedSlug, setSavedSlug] = useState(initialSlug);
	const [savedName, setSavedName] = useState(initialName);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	// Server-side slug rejections (taken/reserved) live in state, not RHF
	// setError — the async zod resolver wipes manual errors on its next pass.
	const [slugServerError, setSlugServerError] = useState<string | null>(null);
	const [liveMessage, setLiveMessage] = useState('');
	const [justCopied, setJustCopied] = useState(false);
	const [pulseCopy, setPulseCopy] = useState(false);
	const pendingValues = useRef<OrgProfileUpdateInput | null>(null);
	const isDesktop = useMediaQuery('(min-width: 768px)');

	// Slug rules apply only when the slug CHANGES — an org whose legacy slug
	// predates the rules (too short, reserved) can still save name-only edits.
	// The server applies the same conditional validation.
	const formSchema = useMemo(
		() =>
			z
				.object({
					name: orgProfileUpdateSchema.shape.name,
					slug: z.string(),
				})
				.superRefine((vals, ctx) => {
					if (vals.slug === savedSlug) return;
					const result = orgSlugSchema.safeParse(vals.slug);
					if (!result.success) {
						for (const issue of result.error.issues) {
							ctx.addIssue({ ...issue, path: ['slug'] });
						}
					}
				}),
		[savedSlug],
	);

	const {
		register,
		handleSubmit,
		reset,
		setValue,
		formState: { errors, isDirty, isValid },
	} = useForm<OrgProfileUpdateInput>({
		resolver: zodResolver(formSchema),
		defaultValues: { name: initialName, slug: initialSlug },
		mode: 'onChange',
	});

	const mutation = trpc.org.updateOrgProfile.useMutation({
		onSuccess: (org) => {
			const slugChanged = org.slug !== savedSlug;
			setSavedSlug(org.slug);
			setSavedName(org.name);
			setServerError(null);
			reset({ name: org.name, slug: org.slug });
			if (slugChanged) {
				toast.success('Organization updated — your apply link has changed');
				setLiveMessage(
					`Saved. Your new apply link is ${APPLY_URL_PREFIX}${org.slug}`,
				);
				// Draw the eye to the updated URL + copy button (6A payoff moment)
				setPulseCopy(true);
				setTimeout(() => setPulseCopy(false), 2000);
			} else {
				toast.success('Organization updated');
				setLiveMessage('Organization updated');
			}
		},
		onError: (err) => {
			// This branch list is a hand-rolled allowlist that happens to agree
			// with the shared one — every code named here is client-safe. Resolve
			// the text through `safeErrorMessage` anyway, so narrowing the real
			// allowlist narrows this too instead of leaving one stale copy behind.
			// The branches stay because they also decide where focus goes.
			const message = safeErrorMessage(err) ?? "Couldn't save — try again";

			if (err.data?.code === 'CONFLICT') {
				// CONFLICT carries two meanings: slug taken AND concurrent-edit
				// race ("reload and retry") — show the server's message, don't
				// hardcode the slug-taken copy.
				setSlugServerError(message);
				setLiveMessage(message);
				document.getElementById('org-slug')?.focus();
			} else if (
				err.data?.code === 'BAD_REQUEST' ||
				err.data?.code === 'TOO_MANY_REQUESTS'
			) {
				setSlugServerError(message);
				setLiveMessage(message);
				document.getElementById('org-slug')?.focus();
			} else {
				setServerError("Couldn't save — try again");
				setLiveMessage("Couldn't save — try again");
			}
		},
	});

	const submit = handleSubmit((values) => {
		setServerError(null);
		setSlugServerError(null);
		if (values.slug !== savedSlug) {
			pendingValues.current = values;
			setConfirmOpen(true);
			return;
		}
		mutation.mutate(values);
	});

	const confirmSlugChange = () => {
		setConfirmOpen(false);
		if (pendingValues.current) {
			mutation.mutate(pendingValues.current);
			pendingValues.current = null;
		}
	};

	// 7B: beforeunload while dirty
	useEffect(() => {
		if (!isDirty) return;
		const onBeforeUnload = (e: BeforeUnloadEvent) => {
			e.preventDefault();
		};
		window.addEventListener('beforeunload', onBeforeUnload);
		return () => window.removeEventListener('beforeunload', onBeforeUnload);
	}, [isDirty]);

	// 7B: flag dirty state for non-anchor navigation (the header OrgSwitcher
	// mutates + router.refresh(), which the anchor interceptor can't see)
	useEffect(() => {
		if (isDirty) {
			document.body.dataset.dirtyForm = 'true';
		} else {
			delete document.body.dataset.dirtyForm;
		}
		return () => {
			delete document.body.dataset.dirtyForm;
		};
	}, [isDirty]);

	// 7B: intercept internal link clicks (sidebar + in-page rows) while dirty
	useEffect(() => {
		if (!isDirty) return;
		const onClick = (e: MouseEvent) => {
			// New-tab/window opens don't discard form state — let them through
			if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
				return;
			const anchor = (e.target as HTMLElement | null)?.closest?.('a[href]');
			if (!anchor) return;
			if (anchor.getAttribute('target') === '_blank') return;
			const href = anchor.getAttribute('href') ?? '';
			if (!href.startsWith('/')) return;
			if (!window.confirm('Discard unsaved changes?')) {
				e.preventDefault();
				e.stopPropagation();
			}
		};
		document.addEventListener('click', onClick, true);
		return () => document.removeEventListener('click', onClick, true);
	}, [isDirty]);

	const copyApplyUrl = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(`${BASE_URL}/apply/${savedSlug}`);
			setJustCopied(true);
			setLiveMessage('Apply link copied');
			setTimeout(() => setJustCopied(false), 2000);
		} catch {
			toast.error("Couldn't copy the link");
		}
	}, [savedSlug]);

	const newSlug = pendingValues.current?.slug ?? '';

	const confirmBody = (
		<>
			<p className="text-sm">
				Your apply link will change to{' '}
				<span className="font-mono text-foreground">
					{APPLY_URL_PREFIX}
					{newSlug}
				</span>
				.
			</p>
			<p className="text-sm text-muted-foreground">
				Your old link ({APPLY_URL_PREFIX}
				{savedSlug}) will keep working and redirect to the new one.
			</p>
		</>
	);

	return (
		<div>
			{/* Live apply link — the page's anchor (decision 2A) */}
			<div className="mb-6">
				<Label className="mb-1.5 block">Live apply link</Label>
				<div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2">
					<span className="truncate font-mono text-sm text-muted-foreground">
						{APPLY_URL_PREFIX}
						{savedSlug}
					</span>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className={`ml-auto h-9 w-9 shrink-0 -my-1 ${pulseCopy ? 'animate-pulse text-primary' : ''}`}
						onClick={copyApplyUrl}
						aria-label="Copy apply link"
					>
						{justCopied ? (
							<Check className="h-4 w-4" />
						) : (
							<Copy className="h-4 w-4" />
						)}
					</Button>
				</div>
			</div>

			{/* Screen-reader announcements: save success / errors (14A) */}
			<output aria-live="polite" className="sr-only">
				{liveMessage}
			</output>

			{!canEdit ? (
				<div className="max-w-xl space-y-4">
					<div>
						<p className="text-sm font-medium">Organization name</p>
						<p className="text-sm text-muted-foreground">{savedName}</p>
					</div>
					<div>
						<p className="text-sm font-medium">URL slug</p>
						<p className="font-mono text-sm text-muted-foreground">
							{savedSlug}
						</p>
					</div>
					<p className="text-xs text-muted-foreground">
						Only owners and admins can edit the organization profile.
					</p>
				</div>
			) : (
				<form onSubmit={submit} className="max-w-xl space-y-4" noValidate>
					{serverError ? (
						<div
							role="alert"
							className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
						>
							<AlertTriangle className="h-4 w-4 shrink-0" />
							{serverError}
						</div>
					) : null}

					<div>
						<Label htmlFor="org-name" className="mb-1.5 block">
							Organization name
						</Label>
						<Input
							id="org-name"
							aria-invalid={!!errors.name}
							aria-describedby={errors.name ? 'org-name-error' : undefined}
							{...register('name')}
						/>
						{errors.name ? (
							<p
								id="org-name-error"
								className="mt-1.5 text-sm text-destructive"
							>
								{errors.name.message}
							</p>
						) : null}
					</div>

					<div>
						<Label htmlFor="org-slug" className="mb-1.5 block">
							URL slug
						</Label>
						<div
							className={`flex items-stretch overflow-hidden rounded-md border focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/50 ${
								errors.slug || slugServerError
									? 'border-destructive'
									: 'border-input'
							}`}
						>
							<span className="flex items-center border-r bg-muted px-3 font-mono text-sm text-muted-foreground">
								<span className="hidden sm:inline">{APPLY_URL_PREFIX}</span>
								<span className="sm:hidden">…/apply/</span>
							</span>
							<Input
								id="org-slug"
								className="rounded-none border-0 shadow-none focus-visible:ring-0"
								aria-invalid={!!errors.slug || !!slugServerError}
								aria-describedby={
									errors.slug || slugServerError ? 'org-slug-error' : undefined
								}
								{...register('slug', {
									onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
										setSlugServerError(null);
										const el = e.target;
										const raw = el.value;
										const normalized = normalizeSlugInput(raw);
										if (normalized !== raw) {
											// Rewriting the value snaps the caret to the end —
											// restore it SYNCHRONOUSLY so mid-slug edits stay in
											// place (async restore races the next keystroke).
											const pos = Math.max(
												0,
												(el.selectionStart ?? raw.length) -
													(raw.length - normalized.length),
											);
											el.value = normalized;
											el.setSelectionRange(pos, pos);
										}
										setValue('slug', normalized, {
											shouldDirty: true,
											shouldValidate: true,
										});
									},
								})}
							/>
						</div>
						{errors.slug || slugServerError ? (
							<p
								id="org-slug-error"
								className="mt-1.5 flex items-center gap-1 text-sm text-destructive"
							>
								<AlertTriangle className="h-3.5 w-3.5 shrink-0" />
								{errors.slug?.message ?? slugServerError}
							</p>
						) : null}
					</div>

					<div className="flex justify-end">
						<Button
							type="submit"
							disabled={!isDirty || !isValid || mutation.isPending}
						>
							{mutation.isPending ? (
								<>
									<Loader2 className="h-4 w-4 animate-spin" />
									Saving…
								</>
							) : (
								'Save'
							)}
						</Button>
					</div>
				</form>
			)}

			{/* Slug-change confirmation (4A): Dialog on desktop, Drawer on mobile (13A) */}
			{isDesktop ? (
				<Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Change your apply link?</DialogTitle>
							<DialogDescription asChild>
								<div className="space-y-2 pt-1">{confirmBody}</div>
							</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<Button variant="outline" onClick={() => setConfirmOpen(false)}>
								Cancel
							</Button>
							<Button onClick={confirmSlugChange}>Change link</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			) : (
				<Drawer open={confirmOpen} onOpenChange={setConfirmOpen}>
					<DrawerContent>
						<DrawerHeader>
							<DrawerTitle>Change your apply link?</DrawerTitle>
							<DrawerDescription asChild>
								<div className="space-y-2 pt-1">{confirmBody}</div>
							</DrawerDescription>
						</DrawerHeader>
						<DrawerFooter>
							<Button onClick={confirmSlugChange}>Change link</Button>
							<Button variant="outline" onClick={() => setConfirmOpen(false)}>
								Cancel
							</Button>
						</DrawerFooter>
					</DrawerContent>
				</Drawer>
			)}
		</div>
	);
}
