import { Plus, Rocket } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Track activity across your organization."
        actions={
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            New opportunity
          </Button>
        }
      />
      <EmptyState
        title="No activity yet"
        description="Once volunteers start applying, you will see updates here."
        icon={Rocket}
        action={<Button variant="outline">Invite teammates</Button>}
      />
    </div>
  );
}
