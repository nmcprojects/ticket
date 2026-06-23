import { RequireRole } from "@/components/require-role";

export default function CheckInLayout({ children }: { children: React.ReactNode }) {
  return <RequireRole role="STAFF">{children}</RequireRole>;
}
