import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export interface OrganizerEventRow {
  id: string;
  name: string;
  date: string;
  venue: string | null;
  price_eur: number;
  capacity: number;
  tickets_sold: number;
  is_private: boolean;
}

export interface ActivityItem {
  eventName: string;
  quantity: number;
  when: string; // ISO timestamp of the newest ticket in the group
  kind: "sale" | "redemption";
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const organizerWallet = new URL(req.url).searchParams.get("organizerWallet");

  if (!organizerWallet) {
    return NextResponse.json(
      { error: "organizerWallet is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("events")
    .select("id, name, date, venue, price_eur, capacity, tickets_sold, is_private")
    .eq("organizer_wallet", organizerWallet)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const events = (data ?? []) as OrganizerEventRow[];
  const totalTickets = events.reduce((sum, e) => sum + (e.tickets_sold ?? 0), 0);
  const eventIds = events.map((e) => e.id);
  const nameById = new Map(events.map((e) => [e.id, e.name]));

  // Recent activity + a 12-day sales sparkline, both from the purchases table.
  let activity: ActivityItem[] = [];
  const sparkline: number[] = new Array(12).fill(0);
  let soldLast7 = 0;
  let soldPrev7 = 0;

  if (eventIds.length > 0) {
    const since = new Date(Date.now() - 14 * 86400000).toISOString();
    const { data: purchases } = await supabaseAdmin
      .from("purchases")
      .select("event_id, stripe_session_id, created_at, redeemed_at")
      .in("event_id", eventIds)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000);

    const rows = purchases ?? [];
    const now = Date.now();

    // Sparkline: tickets per day over the last 12 days (oldest → newest).
    for (const p of rows) {
      const age = now - new Date(p.created_at as string).getTime();
      const daysAgo = Math.floor(age / 86400000);
      if (daysAgo < 12) sparkline[11 - daysAgo] += 1;
      if (daysAgo < 7) soldLast7 += 1;
      else if (daysAgo < 14) soldPrev7 += 1;
    }

    // Activity: group sales by checkout session (one line per purchase, not per ticket).
    const groups = new Map<string, { eventId: string; quantity: number; when: string }>();
    for (const p of rows) {
      const key = p.stripe_session_id as string;
      const g = groups.get(key);
      if (g) {
        g.quantity += 1;
        if ((p.created_at as string) > g.when) g.when = p.created_at as string;
      } else {
        groups.set(key, { eventId: p.event_id as string, quantity: 1, when: p.created_at as string });
      }
    }
    const sales: ActivityItem[] = [...groups.values()].map((g) => ({
      eventName: nameById.get(g.eventId) ?? "Unbekanntes Event",
      quantity: g.quantity,
      when: g.when,
      kind: "sale" as const,
    }));

    const redemptions: ActivityItem[] = rows
      .filter((p) => p.redeemed_at)
      .map((p) => ({
        eventName: nameById.get(p.event_id as string) ?? "Unbekanntes Event",
        quantity: 1,
        when: p.redeemed_at as string,
        kind: "redemption" as const,
      }));

    activity = [...sales, ...redemptions]
      .sort((a, b) => b.when.localeCompare(a.when))
      .slice(0, 6);
  }

  return NextResponse.json({ events, totalTickets, activity, sparkline, soldLast7, soldPrev7 });
}
