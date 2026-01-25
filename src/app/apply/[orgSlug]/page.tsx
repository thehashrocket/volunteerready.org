import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TRPCProvider } from "@/lib/trpc/provider";
import { getPublicFormByOrgSlug } from "@/server/repositories/publicApplyRepo";
import { ApplyFormClient } from "@/app/apply/[orgSlug]/ApplyFormClient";

interface PageProps {
  params: { orgSlug: string };
}

export default async function ApplyPage({ params }: PageProps) {
  const { org, questions } = await getPublicFormByOrgSlug(params.orgSlug);

  if (!org) {
    notFound();
  }

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <h1 className="text-2xl font-semibold">Applications paused</h1>
            <p className="text-sm text-muted-foreground">
              {org.name} is not accepting volunteer applications right now.
            </p>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Please check back soon or contact the organization directly for
              urgent volunteer opportunities.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Volunteer application
        </p>
        <h1 className="text-3xl font-semibold">Apply to {org.name}</h1>
        <p className="text-sm text-muted-foreground">
          Tell us a bit about yourself and we will follow up soon.
        </p>
      </div>
      <TRPCProvider>
        <ApplyFormClient org={org} questions={questions} />
      </TRPCProvider>
    </div>
  );
}
