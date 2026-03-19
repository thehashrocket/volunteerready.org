'use client';

import { Bell, Check } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import { trpc } from '@/lib/trpc/client';
import { formatNotificationAge } from '@/server/domain/notification';

export function NotificationBell() {
	const utils = trpc.useUtils();

	const { data: unreadCount = 0 } = trpc.notifications.unreadCount.useQuery(
		undefined,
		{ refetchInterval: 30_000 },
	);

	const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
		trpc.notifications.list.useInfiniteQuery(
			{ limit: 10 },
			{ getNextPageParam: (last) => last.nextCursor },
		);

	const markRead = trpc.notifications.markRead.useMutation({
		onSuccess: () => {
			void utils.notifications.unreadCount.invalidate();
			void utils.notifications.list.invalidate();
		},
	});

	const markAllRead = trpc.notifications.markAllRead.useMutation({
		onSuccess: () => {
			void utils.notifications.unreadCount.invalidate();
			void utils.notifications.list.invalidate();
		},
	});

	const items = data?.pages.flatMap((p) => p.items) ?? [];

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className="relative h-11 w-11 p-0"
					aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
				>
					<Bell className="h-4 w-4" aria-hidden="true" />
					{unreadCount > 0 && (
						<span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
							{unreadCount > 99 ? '99+' : unreadCount}
						</span>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="w-80 p-0"
				aria-label="Notifications"
			>
				<div className="flex items-center justify-between border-b px-4 py-3">
					<h3 className="text-sm font-semibold">Notifications</h3>
					{unreadCount > 0 && (
						<Button
							variant="ghost"
							size="sm"
							className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
							onClick={() => markAllRead.mutate()}
							disabled={markAllRead.isPending}
						>
							<Check className="mr-1 h-3 w-3" />
							Mark all read
						</Button>
					)}
				</div>

				<div className="max-h-96 overflow-y-auto">
					{items.length === 0 ? (
						<div className="px-4 py-8 text-center">
							<Bell
								className="mx-auto h-8 w-8 text-muted-foreground/40"
								aria-hidden="true"
							/>
							<p className="mt-2 text-sm text-muted-foreground">
								You&apos;re all caught up
							</p>
						</div>
					) : (
						<>
							{items.map((item) => {
								const isUnread = !item.readAt;
								const content = (
									<div
										className={`border-b px-4 py-3 transition-colors hover:bg-muted/50 ${isUnread ? 'bg-primary/5' : ''}`}
									>
										<div className="flex items-start gap-2">
											{isUnread && (
												<span
													className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
													aria-hidden="true"
												/>
											)}
											<div className="min-w-0 flex-1">
												<p className="text-sm font-medium leading-tight">
													{item.title}
												</p>
												<p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
													{item.body}
												</p>
												<p className="mt-1 text-xs text-muted-foreground/60">
													{formatNotificationAge(item.createdAt)}
												</p>
											</div>
										</div>
									</div>
								);

								if (item.href) {
									return (
										<Link
											key={item.id}
											href={item.href}
											onClick={() => {
												if (isUnread) markRead.mutate({ id: item.id });
											}}
										>
											{content}
										</Link>
									);
								}

								return (
									<button
										type="button"
										key={item.id}
										className="w-full text-left"
										onClick={() => {
											if (isUnread) markRead.mutate({ id: item.id });
										}}
									>
										{content}
									</button>
								);
							})}

							{hasNextPage && (
								<div className="px-4 py-2 text-center">
									<Button
										variant="ghost"
										size="sm"
										className="text-xs"
										onClick={() => fetchNextPage()}
										disabled={isFetchingNextPage}
									>
										{isFetchingNextPage ? 'Loading\u2026' : 'Load more'}
									</Button>
								</div>
							)}
						</>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}
