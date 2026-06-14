import { RequireAuth } from "@/components/require-auth";

export default function MyTicketsLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
