import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requestOwnsWallet } from "@/lib/privyServer";
import { isFeePayer, splitServiceFee, type FeePayer } from "@/lib/fees";

export const dynamic = "force-dynamic";

/**
 * Bookkeeping export: one CSV row per order, for a date range.
 *
 * **Not a DATEV Buchungsstapel.** It carries the columns a tax advisor needs to
 * map — date, gross, the platform's cut, what actually reaches the organizer,
 * payment method, payout status — but no accounts, no BU-Schlüssel and no VAT
 * rate, for the same reason the receipt is a "Beleg" and not an invoice: only
 * the organizer knows their own tax situation. Formatted for German Excel
 * (semicolons, decimal comma, UTF-8 BOM).
 *
 * Two sources, because two kinds of money exist:
 * - `payouts` — everything Passly collected (tickets and season passes). The
 *   row already reflects partial refunds.
 * - `purchases` with `source = 'box_office'` — cash the organizer took at the
 *   door. There is no payouts row for it by design, but leaving it out would
 *   hand the organizer an export that doesn't match their till.
 */

interface ExportRow {
  belegnummer: string;
  datum: string;
  art: string;
  produkt: string;
  termin: string;
  kategorie: string;
  anzahl: number;
  bruttoCents: number;
  gebuehrCents: number;
  auszahlungCents: number;
  waehrung: string;
  zahlungsart: string;
  status: string;
  auszahlungAm: string;
  referenz: string;
  /** Sort key; ISO timestamp of the sale. */
  sortAt: string;
}

const HEADERS = [
  "Belegnummer", "Datum", "Art", "Produkt", "Termin", "Kategorie", "Anzahl",
  "Bruttobetrag", "Servicegebühr Passly", "Auszahlung an dich", "Währung",
  "Zahlungsart", "Status", "Auszahlung am", "Referenz",
];

const PAYMENT_LABELS: Record<string, string> = {
  card: "Karte",
  paypal: "PayPal",
  klarna: "Klarna",
  sepa_debit: "SEPA-Lastschrift",
  link: "Link",
  giropay: "giropay",
  sofort: "Sofortüberweisung",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Auszahlung geplant",
  paid: "Ausgezahlt",
  held: "In Prüfung",
  disputed: "Reklamation",
  refunded: "Erstattet",
  failed: "Fehlgeschlagen",
};

/** German decimal comma, two places; Excel reads this as a number. */
function amount(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function day(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleDateString("de-DE", {
    timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric",
  });
}

/** Quotes a field for RFC-4180 CSV; the separator is a semicolon. */
function csvField(value: string | number): string {
  const s = String(value);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function receiptNumber(sessionId: string, createdAt: string): string {
  const t = Date.parse(createdAt);
  const d = Number.isNaN(t) ? "00000000" : new Date(t).toISOString().slice(0, 10).replace(/-/g, "");
  return `PSL-${d}-${sessionId.slice(-6).toUpperCase()}`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const walletAddress = url.searchParams.get("walletAddress") ?? "";
  if (!walletAddress || !(await requestOwnsWallet(req, walletAddress))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Default range: the current calendar year, the unit an organizer files in.
  const today = new Date().toISOString().slice(0, 10);
  const from = url.searchParams.get("from") || `${today.slice(0, 4)}-01-01`;
  const to = url.searchParams.get("to") || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "from/to müssen YYYY-MM-DD sein." }, { status: 400 });
  }
  const fromIso = `${from}T00:00:00.000Z`;
  const toIso = `${to}T23:59:59.999Z`;

  const { data: events } = await supabaseAdmin
    .from("events")
    .select("id, name, date, venue, fee_payer")
    .eq("organizer_wallet", walletAddress);
  const eventRows = (events ?? []) as
    { id: string; name: string; date: string; venue: string | null; fee_payer: string | null }[];
  const eventById = new Map(eventRows.map((e) => [e.id, e]));
  // Box-office rows are priced from the tier, so they also need the event's
  // fee mode to split that fee the same way the door did.
  const feePayerByEvent = new Map<string, FeePayer>(
    eventRows.map((e) => [e.id, isFeePayer(e.fee_payer) ? e.fee_payer : "buyer"]),
  );

  const [{ data: payouts }, { data: passes }] = await Promise.all([
    supabaseAdmin
      .from("payouts")
      .select("stripe_session_id, event_id, season_pass_id, gross_cents, fee_cents, net_cents, currency, status, payment_method, transfer_id, available_at, created_at")
      .eq("organizer_wallet", walletAddress)
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: true })
      .limit(5000),
    supabaseAdmin
      .from("season_passes")
      .select("id, name")
      .eq("organizer_wallet", walletAddress),
  ]);
  const passById = new Map(((passes ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));

  const sessionIds = ((payouts ?? []) as { stripe_session_id: string }[]).map((p) => p.stripe_session_id);

  // Quantity and price category come from the purchase rows of each session.
  const { data: soldRows } = sessionIds.length > 0
    ? await supabaseAdmin
        .from("purchases")
        .select("stripe_session_id, tier_id")
        .in("stripe_session_id", sessionIds)
    : { data: [] };

  const bySession = new Map<string, { count: number; tierId: string | null }>();
  for (const row of (soldRows ?? []) as { stripe_session_id: string; tier_id: string | null }[]) {
    const entry = bySession.get(row.stripe_session_id) ?? { count: 0, tierId: null };
    entry.count += 1;
    entry.tierId = entry.tierId ?? row.tier_id;
    bySession.set(row.stripe_session_id, entry);
  }

  // Box-office cash: no payouts row exists, so these are read straight from
  // the purchase rows and priced from their tier.
  const eventIds = [...eventById.keys()];
  const { data: cashRows } = eventIds.length > 0
    ? await supabaseAdmin
        .from("purchases")
        .select("stripe_session_id, event_id, tier_id, created_at")
        .eq("source", "box_office")
        .in("event_id", eventIds)
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .limit(5000)
    : { data: [] };

  const tierIds = [
    ...new Set([
      ...[...bySession.values()].map((v) => v.tierId),
      ...((cashRows ?? []) as { tier_id: string | null }[]).map((r) => r.tier_id),
    ].filter((id): id is string => Boolean(id))),
  ];
  const { data: tiers } = tierIds.length > 0
    ? await supabaseAdmin.from("ticket_tiers").select("id, name, price_eur").in("id", tierIds)
    : { data: [] };
  const tierById = new Map(
    ((tiers ?? []) as { id: string; name: string; price_eur: number }[]).map((t) => [t.id, t]),
  );

  const rows: ExportRow[] = [];

  for (const p of (payouts ?? []) as {
    stripe_session_id: string; event_id: string | null; season_pass_id: string | null;
    gross_cents: number; fee_cents: number; net_cents: number; currency: string | null;
    status: string; payment_method: string | null; transfer_id: string | null;
    available_at: string; created_at: string;
  }[]) {
    const sold = bySession.get(p.stripe_session_id);
    const tier = sold?.tierId ? tierById.get(sold.tierId) : null;
    const event = p.event_id ? eventById.get(p.event_id) : null;
    const passName = p.season_pass_id ? passById.get(p.season_pass_id) : null;

    rows.push({
      belegnummer: receiptNumber(p.stripe_session_id, p.created_at),
      datum: day(p.created_at),
      art: p.season_pass_id ? "Saisonpass" : "Online",
      produkt: passName ?? event?.name ?? "–",
      termin: p.season_pass_id ? "mehrere Termine" : event ? day(`${event.date}T12:00:00Z`) : "",
      kategorie: tier?.name ?? "",
      anzahl: sold?.count ?? 0,
      bruttoCents: p.gross_cents,
      gebuehrCents: p.fee_cents,
      auszahlungCents: p.net_cents,
      waehrung: (p.currency ?? "eur").toUpperCase(),
      zahlungsart: p.payment_method ? PAYMENT_LABELS[p.payment_method] ?? p.payment_method : "",
      status: STATUS_LABELS[p.status] ?? p.status,
      auszahlungAm: p.status === "paid" || p.status === "pending" ? day(p.available_at) : "",
      referenz: p.transfer_id ?? p.stripe_session_id,
      sortAt: p.created_at,
    });
  }

  // One row per box-office ticket. The guest pays the online total in cash, so
  // the gross carries whatever share of the service fee an online buyer would
  // pay for this event; the difference is that the organizer already holds the
  // whole amount and the full fee is recovered by deducting it from a later
  // transfer. Booking it as fee + payout keeps the export comparable with the
  // online rows instead of overstating door revenue.
  for (const c of (cashRows ?? []) as {
    stripe_session_id: string | null; event_id: string; tier_id: string | null; created_at: string;
  }[]) {
    const event = eventById.get(c.event_id);
    const tier = c.tier_id ? tierById.get(c.tier_id) : null;
    const priceCents = tier?.price_eur ?? 0;
    const { buyerCents, organizerCents, totalCents: feeCents } =
      splitServiceFee(priceCents, feePayerByEvent.get(c.event_id) ?? "buyer");
    rows.push({
      // Own prefix: a cash sale is not a Passly receipt, and the export must
      // not make it look like one.
      belegnummer: `BAR-${(Date.parse(c.created_at) ? new Date(c.created_at).toISOString().slice(0, 10).replace(/-/g, "") : "00000000")}-${(c.stripe_session_id ?? "").slice(-6).toUpperCase() || "------"}`,
      datum: day(c.created_at),
      art: "Abendkasse",
      produkt: event?.name ?? "–",
      termin: event ? day(`${event.date}T12:00:00Z`) : "",
      kategorie: tier?.name ?? "",
      anzahl: 1,
      bruttoCents: priceCents + buyerCents,
      gebuehrCents: feeCents,
      auszahlungCents: priceCents - organizerCents,
      waehrung: "EUR",
      zahlungsart: "Bar",
      status: feeCents > 0 ? "Bar erhalten · Gebühr wird abgezogen" : "Bar erhalten",
      auszahlungAm: "",
      referenz: c.stripe_session_id ?? "",
      sortAt: c.created_at,
    });
  }

  rows.sort((a, b) => a.sortAt.localeCompare(b.sortAt));

  const lines = [
    HEADERS.join(";"),
    ...rows.map((r) => [
      r.belegnummer, r.datum, r.art, r.produkt, r.termin, r.kategorie, r.anzahl,
      amount(r.bruttoCents), amount(r.gebuehrCents), amount(r.auszahlungCents),
      r.waehrung, r.zahlungsart, r.status, r.auszahlungAm, r.referenz,
    ].map(csvField).join(";")),
  ];

  // BOM so Excel opens the umlauts as UTF-8 instead of mangling them.
  const csv = "﻿" + lines.join("\r\n") + "\r\n";

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="passly-export-${from}-bis-${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
