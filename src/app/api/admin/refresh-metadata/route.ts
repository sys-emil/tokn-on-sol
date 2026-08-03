import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/adminAuth";
import {
  uploadEventMetadata,
  uploadPassMetadata,
  listMetadataObjects,
  deleteMetadataObjects,
} from "@/lib/eventMetadata";
import { passEventDates } from "@/lib/seasonPass";

export const maxDuration = 60;

/**
 * Rewrites every `metadata/*.json` in the storage bucket from the current
 * database values.
 *
 * Why this exists: `/api/events/update` already re-uploads the JSON whenever a
 * displayed field changes, but rows edited *directly in the database* (as the
 * brand-name cleanup on 2026-07-29 was) bypass that route entirely, so the
 * public JSON kept the old names. This route is the repair path for any such
 * drift — and the only supported way to fix it, since the files are served
 * publicly and cannot be corrected from the client.
 *
 * Deliberately a rewrite, not a delete: every one of these events has minted
 * tickets, and deleting the JSON would leave those cNFTs pointing at a 404.
 * `writeMetadata` upserts in place, so the URL stamped on-chain stays valid.
 *
 * Note the on-chain limit: a cNFT's *leaf* hashes the name that was minted, so
 * this fixes what wallets and the ticket page display, not the historical
 * on-chain name.
 *
 * POST /api/admin/refresh-metadata   (x-admin-secret)
 *   body: {} | { "eventId": "…" } | { "passId": "…" }
 *         + { "dryRun": true }        report only, write nothing
 *         + { "pruneOrphans": true }  additionally delete JSONs whose event
 *                                     or pass no longer exists
 *
 * `pruneOrphans` exists because deleting a row leaves its JSON behind: Storage
 * has no reference back to the database, so the file stays publicly readable
 * forever. Deleting an event is exactly when that matters.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const denied = requireAdmin(req);
  if (denied) return denied;

  let body: { eventId?: string; passId?: string; dryRun?: boolean; pruneOrphans?: boolean } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // no body means "everything"
  }
  const dryRun = body.dryRun === true;

  const results: { kind: string; id: string; name: string; status: string }[] = [];

  if (!body.passId) {
    let query = supabaseAdmin
      .from("events")
      .select("id, name, date, image_url, venue, description");
    if (body.eventId) query = query.eq("id", body.eventId);

    const { data: events, error } = await query;
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    for (const event of events ?? []) {
      const id = event.id as string;
      const name = event.name as string;
      if (dryRun) {
        results.push({ kind: "event", id, name, status: "would rewrite" });
        continue;
      }
      try {
        await uploadEventMetadata({
          eventId: id,
          name,
          date: event.date as string,
          imageUrl: (event.image_url as string | null) ?? null,
          venue: (event.venue as string | null) ?? null,
          description: (event.description as string | null) ?? null,
        });
        results.push({ kind: "event", id, name, status: "rewritten" });
      } catch (err) {
        results.push({
          kind: "event",
          id,
          name,
          status: `FAILED: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }

  if (!body.eventId) {
    let query = supabaseAdmin
      .from("season_passes")
      .select("id, name, image_url, description");
    if (body.passId) query = query.eq("id", body.passId);

    const { data: passes, error } = await query;
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    for (const pass of passes ?? []) {
      const id = pass.id as string;
      const name = pass.name as string;
      if (dryRun) {
        results.push({ kind: "pass", id, name, status: "would rewrite" });
        continue;
      }
      try {
        await uploadPassMetadata({
          passId: id,
          name,
          imageUrl: (pass.image_url as string | null) ?? null,
          description: (pass.description as string | null) ?? null,
          eventDates: await passEventDates(id),
        });
        results.push({ kind: "pass", id, name, status: "rewritten" });
      } catch (err) {
        results.push({
          kind: "pass",
          id,
          name,
          status: `FAILED: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }

  // Orphans: a JSON whose event or pass no longer exists. Only meaningful for
  // a full run — a single-id call has no view of what else is in the bucket.
  let orphans: string[] = [];
  if (body.pruneOrphans === true && !body.eventId && !body.passId) {
    const [paths, { data: eventRows }, { data: passRows }] = await Promise.all([
      listMetadataObjects(),
      supabaseAdmin.from("events").select("id"),
      supabaseAdmin.from("season_passes").select("id"),
    ]);
    const live = new Set<string>();
    for (const e of eventRows ?? []) live.add(`metadata/${e.id as string}.json`);
    for (const p of passRows ?? []) live.add(`metadata/pass-${p.id as string}.json`);

    orphans = paths.filter((path) => !live.has(path));
    if (!dryRun && orphans.length > 0) {
      const removed = await deleteMetadataObjects(orphans);
      for (const path of orphans) {
        results.push({
          kind: "orphan",
          id: path,
          name: path,
          status: removed.includes(path) ? "deleted" : "FAILED: not confirmed by storage",
        });
      }
    } else {
      for (const path of orphans) {
        results.push({ kind: "orphan", id: path, name: path, status: "would delete" });
      }
    }
  }

  const failed = results.filter((r) => r.status.startsWith("FAILED")).length;
  return NextResponse.json({
    success: failed === 0,
    dryRun,
    count: results.length,
    orphans: orphans.length,
    failed,
    results,
  });
}
