interface EditorialListItem {
	heading: string;
	body: string;
}

interface EditorialListProps {
	items: EditorialListItem[];
}

export function EditorialList({ items }: EditorialListProps) {
	return (
		<div className="space-y-8">
			{items.map((item, index) => (
				<div key={index} className="border-l-2 border-accent pl-6">
					<h3 className="mb-1 font-semibold text-foreground">{item.heading}</h3>
					<p className="text-sm leading-relaxed text-muted-foreground">
						{item.body}
					</p>
				</div>
			))}
		</div>
	);
}
