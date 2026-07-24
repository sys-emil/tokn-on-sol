import { ImageResponse } from 'next/og';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizeHandle } from '@/lib/organizerHandle';

export const alt = 'Veranstalter auf Passly';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Share card for the public organizer page: banner-style gradient with the
 * organizer's avatar/initials, name and (if verified) the purple brand seal.
 */
export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle: raw } = await params;
  const decoded = decodeURIComponent(raw);
  const handle = decoded.startsWith('@') ? normalizeHandle(decoded) : '';

  const { data: org } = handle
    ? await supabaseAdmin
        .from('organizers')
        .select('public_name, business_name, name, type, avatar_url, is_verified, verified_label')
        .ilike('handle', handle)
        .eq('status', 'approved')
        .maybeSingle()
    : { data: null };

  const name =
    (org?.public_name as string | null)?.trim() ||
    (org?.type === 'business' && org?.business_name ? (org.business_name as string) : (org?.name as string | null)) ||
    'Veranstalter';
  const initials = name.slice(0, 2).toUpperCase();
  const avatarUrl = (org?.avatar_url as string | null) ?? null;
  const verified = Boolean(org?.is_verified);
  const verifiedLabel = (org?.verified_label as string | null) ?? 'Verifiziert';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', padding: '72px 84px',
          background: 'radial-gradient(900px 500px at 50% -20%, #ede4fb, #fafafa 60%), #fafafa',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', color: '#7c3aed', display: 'flex' }}>
            Passly
          </div>
          <div style={{ fontSize: 22, color: '#8a8a99', border: '2px solid #e4e4ec', borderRadius: 999, padding: '10px 26px', background: '#ffffff', display: 'flex' }}>
            Veranstalter
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 44 }}>
          <div
            style={{
              width: 176, height: 176, borderRadius: 999, overflow: 'hidden',
              background: 'linear-gradient(135deg, #b79ded, #7c3aed)',
              color: '#ffffff', fontSize: 66, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '-0.02em',
            }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" width={176} height={176} style={{ objectFit: 'cover' }} />
            ) : (
              initials
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <div style={{ fontSize: 70, fontWeight: 700, letterSpacing: '-0.03em', color: '#1c1c2b', display: 'flex' }}>
                {name.slice(0, 20)}
              </div>
              {verified && (
                <div
                  style={{
                    width: 56, height: 56, borderRadius: 999, background: '#7c3aed',
                    color: '#ffffff', fontSize: 34, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  ✓
                </div>
              )}
            </div>
            <div style={{ fontSize: 34, color: '#6d6d7f', display: 'flex' }}>
              {verified ? verifiedLabel : 'Events entdecken & sicher Tickets kaufen'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ fontSize: 26, color: '#8a8a99', display: 'flex' }}>getpassly.de</div>
        </div>
      </div>
    ),
    size,
  );
}
