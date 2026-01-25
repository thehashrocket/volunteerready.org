"use client";

import { trpc } from "@/lib/trpc/client";

export default function DevPage() {
  const ping = trpc.health.ping.useQuery();
  const currentOrg = trpc.org.getCurrentOrg.useQuery();

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dev Console</h1>
        <p className="text-muted-foreground">
          tRPC health and org context checks.
        </p>
      </div>
      <div className="rounded-lg border p-4">
        <h2 className="text-sm font-semibold">health.ping</h2>
        <pre className="mt-2 overflow-auto text-sm text-muted-foreground">
          {ping.isLoading ? "Loading..." : JSON.stringify(ping.data, null, 2)}
        </pre>
      </div>
      <div className="rounded-lg border p-4">
        <h2 className="text-sm font-semibold">org.getCurrentOrg</h2>
        <pre className="mt-2 overflow-auto text-sm text-muted-foreground">
          {currentOrg.isLoading
            ? "Loading..."
            : JSON.stringify(currentOrg.data, null, 2)}
        </pre>
      </div>
    </section>
  );
}
