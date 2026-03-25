'use client';

import {
	Check,
	CheckCircle,
	Heart,
	Loader2,
	MessageSquare,
	Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
} from '@/components/ui/drawer';
import { MOOD_UI_CONFIG } from '@/lib/feedback-config';
import { useMediaQuery } from '@/lib/hooks/use-media-query';
import { trpc } from '@/lib/trpc/client';
import type { FeedbackMood } from '@/prisma/generated/client';

// ---------------------------------------------------------------------------
// Confirmation icon map
// ---------------------------------------------------------------------------

const CONFIRMATION_ICONS = {
	CheckCircle,
	Heart,
	Sparkles,
	Check,
} as const;

// ---------------------------------------------------------------------------
// Mood selector
// ---------------------------------------------------------------------------

const MOODS: FeedbackMood[] = ['HAPPY', 'NEUTRAL', 'FRUSTRATED', 'BUG', 'IDEA'];

function MoodSelector({
	selected,
	onSelect,
}: {
	selected: FeedbackMood | null;
	onSelect: (mood: FeedbackMood) => void;
}) {
	const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
		let nextIndex = index;
		if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
			e.preventDefault();
			nextIndex = (index + 1) % MOODS.length;
		} else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
			e.preventDefault();
			nextIndex = (index - 1 + MOODS.length) % MOODS.length;
		} else if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onSelect(MOODS[index]);
			return;
		} else {
			return;
		}
		onSelect(MOODS[nextIndex]);
	};

	return (
		<div>
			<p className="mb-3 text-base text-muted-foreground">
				How are things going?
			</p>
			<div
				role="radiogroup"
				aria-label="How are things going?"
				className="flex justify-center gap-3"
			>
				{MOODS.map((mood, i) => {
					const config = MOOD_UI_CONFIG[mood];
					const Icon = config.icon;
					const isSelected = selected === mood;
					return (
						// biome-ignore lint/a11y/useSemanticElements: styled buttons with role="radio" for visual mood selector per design spec
						<button
							key={mood}
							type="button"
							role="radio"
							aria-checked={isSelected}
							aria-label={config.label}
							tabIndex={isSelected || (!selected && i === 0) ? 0 : -1}
							onClick={() => onSelect(mood)}
							onKeyDown={(e) => handleKeyDown(e, i)}
							className={`flex w-14 flex-col items-center gap-1 rounded-lg p-2 transition-all duration-150 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
								isSelected
									? 'border-b-2 border-primary bg-primary/[0.08] text-primary'
									: 'bg-muted text-foreground hover:bg-muted/80'
							}`}
						>
							<Icon className="h-6 w-6" />
							<span className="text-xs font-semibold">{config.label}</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Feedback form content (shared between Dialog and Drawer)
// ---------------------------------------------------------------------------

function FeedbackFormContent({ onClose }: { onClose: () => void }) {
	const [mood, setMood] = useState<FeedbackMood | null>(null);
	const [message, setMessage] = useState('');
	const [state, setState] = useState<
		'form' | 'submitting' | 'success' | 'error' | 'rate-limited'
	>('form');
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const utils = trpc.useUtils();

	const submitMutation = trpc.feedback.submit.useMutation({
		onSuccess: () => {
			setState('success');
			utils.feedback.myFeedback.invalidate();
			setTimeout(() => {
				onClose();
				// Reset after close animation
				setTimeout(() => {
					setMood(null);
					setMessage('');
					setState('form');
				}, 200);
			}, 2500);
		},
		onError: (err) => {
			if (err.data?.code === 'TOO_MANY_REQUESTS') {
				setState('rate-limited');
			} else {
				setState('error');
			}
		},
	});

	const handleSubmit = () => {
		if (!mood || !message.trim()) return;
		setState('submitting');
		submitMutation.mutate({
			mood,
			message: message.trim(),
			pageUrl: window.location.pathname,
			userAgent: navigator.userAgent,
		});
	};

	// Focus textarea after mood selection
	useEffect(() => {
		if (mood && textareaRef.current && state === 'form') {
			textareaRef.current.focus();
		}
	}, [mood, state]);

	if (state === 'rate-limited') {
		return (
			<div className="py-4 text-center">
				<p className="text-base text-muted-foreground">
					You've shared a lot of feedback recently — thank you! Please wait a
					bit before sending more.
				</p>
			</div>
		);
	}

	if (state === 'success' && mood) {
		const config = MOOD_UI_CONFIG[mood];
		const ConfirmIcon = CONFIRMATION_ICONS[config.confirmationIcon];
		return (
			<div
				role="status"
				aria-live="polite"
				className="flex flex-col items-center gap-3 py-6"
			>
				<ConfirmIcon className="h-8 w-8 text-primary" />
				<p className="text-center text-base font-semibold text-foreground">
					{config.confirmation}
				</p>
				<Link
					href="/app/my-feedback"
					className="text-sm text-primary underline-offset-4 hover:underline"
				>
					View your feedback history &rarr;
				</Link>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<MoodSelector selected={mood} onSelect={setMood} />

			{mood && (
				<>
					<textarea
						ref={textareaRef}
						value={message}
						onChange={(e) => setMessage(e.target.value)}
						placeholder="Tell us more..."
						maxLength={2000}
						className="min-h-[120px] w-full resize-none rounded-sm bg-muted p-3 text-base text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
					/>

					{state === 'error' && (
						<p
							role="status"
							aria-live="polite"
							className="text-sm text-destructive"
						>
							Failed to send — please try again.
						</p>
					)}

					<button
						type="button"
						onClick={handleSubmit}
						disabled={!message.trim() || state === 'submitting'}
						className="flex h-11 w-full items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-light disabled:opacity-50"
					>
						{state === 'submitting' ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							'Send feedback'
						)}
					</button>
				</>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Main widget
// ---------------------------------------------------------------------------

export function FeedbackWidget() {
	const [open, setOpen] = useState(false);
	const isDesktop = useMediaQuery('(min-width: 768px)');
	const pillRef = useRef<HTMLButtonElement>(null);

	const handleClose = useCallback(() => {
		setOpen(false);
		// Return focus to pill
		setTimeout(() => pillRef.current?.focus(), 100);
	}, []);

	const title = 'Share feedback';
	const subtitle = 'with the VolunteerReady team';

	return (
		<>
			{/* Feedback pill */}
			<button
				ref={pillRef}
				type="button"
				onClick={() => setOpen(true)}
				className="fixed right-4 z-40 flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg transition-all duration-150 hover:scale-[1.02] hover:bg-primary-light focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.98]"
				style={{
					bottom:
						'calc(16px + var(--cookie-banner-height, 0px) + env(safe-area-inset-bottom, 0px))',
				}}
			>
				<MessageSquare className="h-5 w-5" />
				Send feedback
			</button>

			{/* Desktop: Dialog */}
			{isDesktop ? (
				<Dialog open={open} onOpenChange={setOpen}>
					<DialogContent className="sm:max-w-[440px]">
						<DialogHeader>
							<DialogTitle className="text-xl font-semibold">
								{title}
							</DialogTitle>
							<DialogDescription>{subtitle}</DialogDescription>
						</DialogHeader>
						<FeedbackFormContent onClose={handleClose} />
					</DialogContent>
				</Dialog>
			) : (
				<Drawer open={open} onOpenChange={setOpen}>
					<DrawerContent>
						<DrawerHeader>
							<DrawerTitle className="text-xl font-semibold">
								{title}
							</DrawerTitle>
							<DrawerDescription>{subtitle}</DrawerDescription>
						</DrawerHeader>
						<div className="px-4 pb-6">
							<FeedbackFormContent onClose={handleClose} />
						</div>
					</DrawerContent>
				</Drawer>
			)}
		</>
	);
}
