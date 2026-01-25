import { TRPCProvider } from "@/lib/trpc/provider";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TRPCProvider>{children}</TRPCProvider>;
}
