import { requestUser } from "@/lib/sessionUser";
import { supabaseAdmin } from "@/lib/supabase";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { sendAdminAlert, sendOrganizerWelcome } from "@/lib/email";
import { isBot, botDenied } from "@/lib/botCheck";
import { NextRequest, NextResponse } from "next/server";

interface ApplyBody {
  walletAddress: string;
  email: string;
  name: string;
  type: "private" | "business";
  businessName?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rl = rateLimit(`organizer-apply:${clientIp(req)}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: "Zu viele Anfragen. Bitte kurz warten." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  if (await isBot()) return botDenied();

  // Die Anmeldung selbst laeuft ueber einen Einmalcode an diese Adresse, die
  // E-Mail ist also per Konstruktion bestaetigt. Die frueher noetige separate
  // Verifizierung entfaellt damit.
  const sessionUser = await requestUser(req);
  if (!sessionUser) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!sessionUser.email) {
    return NextResponse.json({ success: false, error: "email_required" }, { status: 403 });
  }

  let body: ApplyBody;
  try {
    body = (await req.json()) as ApplyBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const { walletAddress, email, name, type, businessName } = body;

  if (!walletAddress || !email?.trim() || !name?.trim() || !type) {
    return NextResponse.json(
      { success: false, error: "walletAddress, email, name, and type are required" },
      { status: 400 },
    );
  }

  if (type !== "private" && type !== "business") {
    return NextResponse.json({ success: false, error: "type must be private or business" }, { status: 400 });
  }

  if (type === "business" && !businessName?.trim()) {
    return NextResponse.json(
      { success: false, error: "businessName is required for business accounts" },
      { status: 400 },
    );
  }

  // Reject duplicate applications
  const { data: existing } = await supabaseAdmin
    .from("organizers")
    .select("status")
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { success: false, error: "An application already exists for this wallet" },
      { status: 409 },
    );
  }

  // Freigabe automatisch (seit 2026-09-07). Das frühere manuelle Tor entschied
  // über vier selbstbehauptete Felder und prüfte damit nichts, was Stripes KYC
  // nicht besser prüft — gekostet hat es einen Werktag Konversion an der
  // Stelle der höchsten Motivation. An seine Stelle sind zwei Tore getreten,
  // die auf echte Signale schauen: `organizers.is_vetted` (Stripe-KYC oder
  // Admin) für die öffentliche Sichtbarkeit, und der Auszahlungs-Puffer fürs
  // Geld (`effectiveHoldDays` in src/lib/payouts.ts).
  const { error } = await supabaseAdmin.from("organizers").insert({
    wallet_address: walletAddress,
    email: email.trim(),
    name: name.trim(),
    type,
    business_name: type === "business" ? (businessName?.trim() ?? null) : null,
    status: "approved",
  });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const baseUrl = process.env.APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  // Fire-and-forget. Der Admin-Alert bleibt: die Freigabe fällt weg, der Blick
  // auf jeden Neuzugang soll es nicht.
  void sendAdminAlert({
    subject: "Neuer Veranstalter",
    text: `${name.trim()} (${email.trim()}, ${type}${type === "business" ? `, ${businessName?.trim()}` : ""}) hat sich registriert.\nWallet: ${walletAddress}\n\nNoch nicht öffentlich gelistet; das passiert automatisch mit dem Stripe-Onboarding oder von Hand unter /admin?tab=organizers`,
  }).catch(() => {});

  void sendOrganizerWelcome({ to: email.trim(), name: name.trim(), baseUrl }).catch(() => {});

  return NextResponse.json({ success: true, status: "approved" });
}
