import Home from "@/views/Home";
import { api } from "@/lib/api";
import type { AppEvent } from "@/lib/types";

export const revalidate = 60;

export default async function HomePage() {
  let initialEvents: AppEvent[] = [];
  try {
    initialEvents = await api.listEvents({ status: "PUBLISHED" });
  } catch {
    initialEvents = [];
  }
  return <Home initialEvents={initialEvents} />;
}
