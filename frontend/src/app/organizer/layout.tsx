import { RequireRole } from "@/components/require-role";

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  return <RequireRole role="ORGANIZER">{children}</RequireRole>;
}
