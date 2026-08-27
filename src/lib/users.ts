import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { deriveAddress } from "@/lib/wallet";

export interface PasslyUser {
  id: string;
  authSubject: string;
  email: string;
  walletAddress: string;
  keyVersion: number;
}

const COLUMNS = "id, auth_subject, email, wallet_address, key_version";

interface Row {
  id: string;
  auth_subject: string;
  email: string;
  wallet_address: string;
  key_version: number;
}

function toUser(row: Row): PasslyUser {
  return {
    id: row.id,
    authSubject: row.auth_subject,
    email: row.email,
    walletAddress: row.wallet_address,
    keyVersion: row.key_version,
  };
}

async function selectBySubject(authSubject: string): Promise<PasslyUser | null> {
  const { data } = await supabaseAdmin
    .from("users")
    .select(COLUMNS)
    .eq("auth_subject", authSubject)
    .maybeSingle();
  return data ? toUser(data as Row) : null;
}

/**
 * The user behind a login, creating the row on first sight.
 *
 * `auth_subject` is whoever is currently doing the authenticating — the Privy
 * DID today, the Supabase user id after the swap. It is deliberately NOT the
 * derivation source: swapping the provider must not move a single address.
 *
 * The id is minted here rather than by the database, because the address is
 * derived from it and `wallet_address` is NOT NULL — the row cannot be written
 * before the id exists.
 */
export async function getOrCreateUser(authSubject: string, email: string): Promise<PasslyUser> {
  const subject = authSubject.trim();
  if (!subject) throw new Error("authSubject is required");

  const existing = await selectBySubject(subject);
  if (existing) return existing;

  const id = randomUUID();
  const { data, error } = await supabaseAdmin
    .from("users")
    .insert({
      id,
      auth_subject: subject,
      email: email.trim().toLowerCase(),
      wallet_address: deriveAddress(id),
      key_version: 1,
    })
    .select(COLUMNS)
    .single();

  if (error) {
    // Two first requests from the same fresh login race here; the unique index
    // on auth_subject is what decides, and the loser reads the winner's row.
    // Retrying the insert would mint a second id and a second address.
    if (error.code === "23505") {
      const row = await selectBySubject(subject);
      if (row) return row;
    }
    throw new Error(`Could not create user: ${error.message}`);
  }

  return toUser(data as Row);
}

/** Reverse lookup for routes that hold an address rather than a session. */
export async function findUserByWallet(walletAddress: string): Promise<PasslyUser | null> {
  const { data } = await supabaseAdmin
    .from("users")
    .select(COLUMNS)
    .eq("wallet_address", walletAddress)
    .maybeSingle();
  return data ? toUser(data as Row) : null;
}
