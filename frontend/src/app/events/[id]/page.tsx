import type { Metadata } from "next";
import EventDetail from "@/views/EventDetail";
import { api } from "@/lib/api";
import type { AppEvent } from "@/lib/types";

// ISR: cached + prefetchable for fast navigation; refreshed at most every 30s.
export const revalidate = 30;

async function fetchEvent(id: string): Promise<AppEvent | undefined> {
  try {
    return await api.getEvent(id);
  } catch {
    return undefined;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const ev = await fetchEvent(params.id);
  if (!ev) return { title: "Sự kiện" };
  const description =
    (ev.description && ev.description.slice(0, 200)) ||
    `Đặt vé ${ev.title} tại ${ev.venue}, ${ev.city}. Vé điện tử, thanh toán an toàn trên TicketHub.`;
  const images = ev.bannerUrl ? [{ url: ev.bannerUrl }] : [];
  return {
    title: ev.title,
    description,
    openGraph: { title: ev.title, description, images, type: "website" },
    twitter: {
      card: "summary_large_image",
      title: ev.title,
      description,
      images: ev.bannerUrl ? [ev.bannerUrl] : [],
    },
  };
}

export default async function EventDetailPage({ params }: { params: { id: string } }) {
  const initialEvent = await fetchEvent(params.id);
  return <EventDetail initialEvent={initialEvent} />;
}
