import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requestOwnsWallet } from "@/lib/privyServer";

export const dynamic = "force-dynamic";

/**
 * Event detail for the organizer dashboard: event data plus the issued
 * tickets (incl. buyer emails from mint_jobs) and redemption stats.
 * Requires a Privy Bearer token proving ownership of the event's
 * organizer wallet — ticket buyer emails are personal data.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { data: event, error } = await supabaseAdmin
    .from("events")
    .select("id, organizer_wallet, name, date, venue, description, price_eur, capacity, tickets_sold, tickets_reserved, is_private, payout_hold_days, image_url, cancelled_at")
    .eq("id", id)
    .single();

  if (error || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (!(await requestOwnsWallet(req, event.organizer_wallet as string))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: purchases } = await supabaseAdmin
    .from("purchases")
    .select("asset_id, stripe_session_id, created_at, redeemed_at, revoked_at")
    .eq("event_id", id)
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = purchases ?? [];

  // Buyer emails live on the mint job (one per checkout session).
  const sessionIds = [...new Set(rows.map((p) => p.stripe_session_id as string).filter(Boolean))];
  const emailBySession = new Map<string, string>();
  if (sessionIds.length > 0) {
    const { data: jobs } = await supabaseAdmin
      .from("mint_jobs")
      .select("stripe_session_id, buyer_email")
      .in("stripe_session_id", sessionIds);
    for (const j of jobs ?? []) {
      if (j.buyer_email) emailBySession.set(j.stripe_session_id as string, j.buyer_email as string);
    }
  }

  // Serial = mint order (oldest ticket is #001).
  const total = rows.length;
  const tickets = rows.map((p, i) => ({
    assetId: p.asset_id as string,
    serial: String(total - i).padStart(3, "0"),
    email: emailBySession.get(p.stripe_session_id as string) ?? null,
    issuedAt: p.created_at as string,
    status: p.revoked_at ? "revoked" : p.redeemed_at ? "checked" : "valid",
  }));

  const checkedIn = tickets.filter((t) => t.status === "checked").length;
  const revoked = tickets.filter((t) => t.status === "revoked").length;

  const { data: tiers } = await supabaseAdmin
    .from("ticket_tiers")
    .select("id, name, price_eur, capacity, tickets_sold, tickets_reserved, sort")
    .eq("event_id", id)
    .order("sort")
    .order("created_at");

  const eventPublic = { ...(event as Record<string, unknown>) };
  delete eventPublic.organizer_wallet;

  return NextResponse.json({
    event: eventPublic,
    tiers: tiers ?? [],
    tickets,
    stats: { checkedIn, revoked },
  });
}
