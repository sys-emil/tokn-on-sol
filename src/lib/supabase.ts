import { createClient } from "@supabase/supabase-js";

export type OrganizerStatus = 'pending' | 'approved' | 'rejected';
export type OrganizerType = 'private' | 'business';

export type { BadgeType } from "@/lib/badgeMeta";
import type { BadgeType as BadgeTypeImport } from "@/lib/badgeMeta";

export type Badge = {
  id: string;
  wallet_address: string;
  badge_type: BadgeTypeImport;
  asset_id: string | null;
  earned_at: string;
  event_id: string | null;
  organizer_wallet: string | null;
};

export type Organizer = {
  id: string;
  wallet_address: string;
  email: string;
  name: string;
  type: OrganizerType;
  business_name: string | null;
  status: OrganizerStatus;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
  created_at: string;
};

export type TicketTier = {
  id: string;
  event_id: string;
  name: string;
  price_eur: number;
  capacity: number;
  tickets_sold: number;
  tickets_reserved: number;
  sort: number;
  created_at: string;
};

export type Event = {
  id: string;
  organizer_wallet: string;
  name: string;
  date: string;
  /** Optional start time "HH:MM" (Europe/Berlin); NULL for events created before the field existed. */
  start_time: string | null;
  price_eur: number;
  capacity: number;
  tickets_sold: number;
  tickets_reserved: number;
  is_private: boolean;
  payout_hold_days: number;
  image_url: string | null;
  metadata_uri: string | null;
  venue: string | null;
  description: string | null;
  /** Max resale markup over face value in percent. NULL = resale disabled for this event. */
  resale_max_markup_pct: number | null;
  created_at: string;
};

export type ResaleListingStatus = 'active' | 'reserved' | 'sold' | 'cancelled';

export type ResaleListing = {
  id: string;
  asset_id: string;
  event_id: string;
  tier_id: string | null;
  seller_wallet: string;
  list_price_cents: number;
  face_value_cents: number;
  fee_cents: number;
  net_cents: number;
  currency: string;
  status: ResaleListingStatus;
  stripe_session_id: string | null;
  reserved_until: string | null;
  buyer_wallet: string | null;
  transferred_at: string | null;
  credited_at: string | null;
  created_at: string;
  updated_at: string;
  sold_at: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey);

function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("supabaseAdmin must only be used server-side");
  }
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const supabaseAdmin = createAdminClient();
