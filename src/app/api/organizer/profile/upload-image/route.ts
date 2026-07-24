import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requestOwnsWallet } from "@/lib/privyServer";
import { uploadProfileImage, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/eventMetadata";

/**
 * Uploads an organizer profile image (avatar or banner) to Supabase Storage
 * and returns its public URL. Called by the profile editor before PUT
 * /api/organizer/profile, which persists the returned URL. Same auth + limits
 * as /api/events/upload-image.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ success: false, error: "Expected multipart form data" }, { status: 400 });
  }

  const organizerWallet = form.get("organizer_wallet");
  const kind = form.get("kind");
  const file = form.get("file");

  if (typeof organizerWallet !== "string" || !organizerWallet) {
    return NextResponse.json({ success: false, error: "organizer_wallet is required" }, { status: 400 });
  }
  if (kind !== "avatar" && kind !== "banner") {
    return NextResponse.json({ success: false, error: "kind must be 'avatar' or 'banner'" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: "file is required" }, { status: 400 });
  }
  if (!ALLOWED_IMAGE_TYPES[file.type]) {
    return NextResponse.json(
      { success: false, error: "Only JPEG, PNG or WebP images are allowed" },
      { status: 400 },
    );
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { success: false, error: "Image must be 4 MB or smaller" },
      { status: 400 },
    );
  }

  if (!(await requestOwnsWallet(req, organizerWallet))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: organizer } = await supabaseAdmin
    .from("organizers")
    .select("status")
    .eq("wallet_address", organizerWallet)
    .eq("status", "approved")
    .maybeSingle();
  if (!organizer) {
    return NextResponse.json({ success: false, error: "Not an approved organizer" }, { status: 403 });
  }

  try {
    const url = await uploadProfileImage(await file.arrayBuffer(), file.type, kind);
    return NextResponse.json({ success: true, url });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
