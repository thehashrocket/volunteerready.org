import Link from 'next/link';

export function PublicHeader() {
	return (
		<header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur-sm">
			<div className="container mx-auto flex h-14 items-center justify-between px-4">
				<Link href="/" className="flex items-center gap-2.5">
					<div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
						V
					</div>
					<span className="text-sm font-semibold tracking-tight text-foreground">
						VolunteerReady
					</span>
				</Link>
				<nav className="flex items-center gap-4 text-sm">
					<Link
						href="/login"
						className="text-muted-foreground transition-colors hover:text-foreground"
					>
						Sign in
					</Link>
				</nav>
			</div>
		</header>
	);
}
