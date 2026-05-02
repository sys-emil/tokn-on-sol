import { createClient } from "@supabase/supabase-js";

export type OrganizerStatus = 'pending' | 'approved' | 'rejected';
export type OrganizerType = 'private' | 'business';

export type Organizer = {
  id: string;
  wallet_address: string;
  email: string;
  name: string;
  type: OrganizerType;
  business_name: string | null;
  status: OrganizerStatus;
  created_at: string;
};

export type Event = {
  id: string;
  organizer_wallet: string;
  name: string;
  date: string;
  price_eur: number;
  capacity: number;
  tickets_sold: number;
  created_at: string;
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
