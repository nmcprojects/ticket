import type { Metadata } from "next";
import Events from "@/views/Events";
import { api } from "@/lib/api";
import type { AppEvent } from "@/lib/types";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Tất cả sự kiện",
  description:
    "Khám phá và đặt vé sự kiện: âm nhạc, sân khấu, nghệ thuật, thể thao, workshop và hội thảo trên TicketHub.",
};

export default async function EventsPage() {
  let initialEvents: AppEvent[] = [];
  try {
    initialEvents = await api.listEvents();
  } catch {
    initialEvents = [];
  }
  return <Events initialEvents={initialEvents} />;
}
