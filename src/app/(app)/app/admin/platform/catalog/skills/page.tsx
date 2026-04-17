'use client';

import { Loader2, Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { trpc } from '@/lib/trpc/client';
import { SkillFamilyFormDialog } from './_components/skill-family-form';
import { SkillFormDialog } from './_components/skill-form';

type FamilyRow = {
	id: string;
	name: string;
	slug: string;
	isActive: boolean;
	order: number;
};

type SkillRow = {
	id: string;
	name: string;
	slug: string;
	familyId: string;
	isActive: boolean;
	order: number;
};

export default function PlatformCatalogSkillsPage() {
	const { data, isLoading, isError } =
		trpc.platformCatalog.getCatalog.useQuery();

	const [familyModalOpen, setFamilyModalOpen] = useState(false);
	const [editingFamily, setEditingFamily] = useState<FamilyRow | undefined>();
	const [skillModalOpen, setSkillModalOpen] = useState(false);
	const [editingSkill, setEditingSkill] = useState<SkillRow | undefined>();

	const skillsByFamily = useMemo(() => {
		const map = new Map<string, NonNullable<typeof data>['skills']>();
		if (!data) return map;
		for (const skill of data.skills) {
			const list = map.get(skill.familyId) ?? [];
			list.push(skill);
			map.set(skill.familyId, list);
		}
		return map;
	}, [data]);

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<PageHeader
					title="Skill catalog"
					description="Families and skills across all orgs. Edits are live — no deploy."
				/>
				<div className="flex gap-2">
					<Button
						variant="outline"
						onClick={() => {
							setEditingFamily(undefined);
							setFamilyModalOpen(true);
						}}
					>
						<Plus className="mr-2 h-4 w-4" />
						Family
					</Button>
					<Button
						onClick={() => {
							setEditingSkill(undefined);
							setSkillModalOpen(true);
						}}
						disabled={!data || data.families.length === 0}
					>
						<Plus className="mr-2 h-4 w-4" />
						Skill
					</Button>
				</div>
			</div>

			{isLoading ? (
				<div className="flex items-center justify-center py-12">
					<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
				</div>
			) : isError || !data ? (
				<Card className="p-6 text-sm text-destructive">
					Failed to load catalog.
				</Card>
			) : (
				<div className="space-y-4">
					{data.families.map((family) => {
						const skills = skillsByFamily.get(family.id) ?? [];
						return (
							<Card key={family.id} className="divide-y">
								<div className="flex items-center justify-between gap-3 px-4 py-3">
									<div className="min-w-0">
										<div className="flex items-center gap-2">
											<span className="font-medium">{family.name}</span>
											<Badge variant="outline" className="text-xs">
												{family.slug}
											</Badge>
											{!family.isActive && (
												<Badge variant="secondary" className="text-xs">
													inactive
												</Badge>
											)}
										</div>
										<div className="text-xs text-muted-foreground">
											{skills.length} {skills.length === 1 ? 'skill' : 'skills'}{' '}
											· order {family.order}
										</div>
									</div>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => {
											setEditingFamily({
												id: family.id,
												name: family.name,
												slug: family.slug,
												isActive: family.isActive,
												order: family.order,
											});
											setFamilyModalOpen(true);
										}}
									>
										<Pencil className="mr-2 h-3.5 w-3.5" />
										Edit
									</Button>
								</div>
								<div className="divide-y">
									{skills.length === 0 ? (
										<div className="px-4 py-3 text-sm text-muted-foreground">
											No skills in this family yet.
										</div>
									) : (
										skills.map((skill) => (
											<div
												key={skill.id}
												className="flex items-center justify-between gap-3 px-4 py-2.5"
											>
												<div className="min-w-0">
													<div className="flex items-center gap-2">
														<span className="text-sm">{skill.name}</span>
														<Badge variant="outline" className="text-xs">
															{skill.slug}
														</Badge>
														{!skill.isActive && (
															<Badge variant="secondary" className="text-xs">
																inactive
															</Badge>
														)}
													</div>
													<div className="text-xs text-muted-foreground">
														order {skill.order}
													</div>
												</div>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => {
														setEditingSkill({
															id: skill.id,
															name: skill.name,
															slug: skill.slug,
															familyId: skill.familyId,
															isActive: skill.isActive,
															order: skill.order,
														});
														setSkillModalOpen(true);
													}}
												>
													<Pencil className="mr-2 h-3.5 w-3.5" />
													Edit
												</Button>
											</div>
										))
									)}
								</div>
							</Card>
						);
					})}
					{data.families.length === 0 && (
						<Card className="p-6 text-sm text-muted-foreground">
							No skill families yet. Add one to get started.
						</Card>
					)}
				</div>
			)}

			<SkillFamilyFormDialog
				open={familyModalOpen}
				onOpenChange={setFamilyModalOpen}
				initial={editingFamily}
			/>
			<SkillFormDialog
				open={skillModalOpen}
				onOpenChange={setSkillModalOpen}
				initial={editingSkill}
				families={data?.families ?? []}
			/>
		</div>
	);
}
