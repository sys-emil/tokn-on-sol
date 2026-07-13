import { ImageResponse } from 'next/og';
import { supabaseAdmin } from '@/lib/supabase';
import { badgeDisplay } from '@/lib/badgeMeta';

export const alt = 'Öffentliches Profil auf Passly';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Share card for the public collection: "Ich war bei 12 Shows dabei" as an
 * OG image, so every shared profile link markets Passly. Private profiles get
 * the generic card — the image must never leak what the page itself hides.
 */
export default async function Image({
  params,
}: {
  params: Promise<{ walletAddress: string }>;
}) {
  const { walletAddress } = await params;

  const [{ data: profile }, { count: attended }, { data: badges }] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('display_name, is_private')
      .eq('wallet_address', walletAddress)
      .maybeSingle(),
    supabaseAdmin
      .from('purchases')
      .select('*', { count: 'exact', head: true })
      .eq('buyer_wallet', walletAddress)
      .not('redeemed_at', 'is', null),
    supabaseAdmin
      .from('badges')
      .select('badge_type')
      .eq('wallet_address', walletAddress)
      .order('earned_at', { ascending: true })
      .limit(6),
  ]);

  const isPrivate = Boolean(profile?.is_private);
  const displayName = isPrivate
    ? 'Eine Sammlung auf Passly'
    : (profile?.display_name as string | null)?.trim() || 'Konzertgänger:in';
  const attendedCount = isPrivate ? null : attended ?? 0;
  const badgeSymbols = isPrivate
    ? []
    : ((badges ?? []) as { badge_type: string }[]).map((b) => badgeDisplay(b.badge_type));
  const initials = displayName.slice(0, 2).toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 84px',
          background:
            'radial-gradient(900px 500px at 50% -20%, #ede4fb, #fafafa 60%), #fafafa',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: '#7c3aed',
              display: 'flex',
            }}
          >
            Passly
          </div>
          <div
            style={{
              fontSize: 22,
              color: '#8a8a99',
              border: '2px solid #e4e4ec',
              borderRadius: 999,
              padding: '10px 26px',
              background: '#ffffff',
              display: 'flex',
            }}
          >
            Öffentliches Profil
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 44 }}>
          <div
            style={{
              width: 168,
              height: 168,
              borderRadius: 999,
              background: 'linear-gradient(135deg, #b79ded, #7c3aed)',
              color: '#ffffff',
              fontSize: 64,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              letterSpacing: '-0.02em',
            }}
          >
            {initials}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                fontSize: 74,
                fontWeight: 700,
                letterSpacing: '-0.03em',
                color: '#1c1c2b',
                display: 'flex',
              }}
            >
              {displayName.slice(0, 24)}
            </div>
            {attendedCount !== null && (
              <div style={{ fontSize: 36, color: '#6d6d7f', display: 'flex' }}>
                {`${attendedCount} Event${attendedCount === 1 ? '' : 's'} besucht`}
                {badgeSymbols.length > 0 ? ` · ${badgeSymbols.length} Abzeichen` : ''}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 18 }}>
            {badgeSymbols.map((b, i) => (
              <div
                key={i}
                style={{
                  width: 92,
                  height: 92,
                  borderRadius: 26,
                  background: `linear-gradient(140deg, hsl(${b.hue} 90% 97%), hsl(${b.hue} 65% 88%))`,
                  border: `2px solid hsl(${b.hue} 50% 76%)`,
                  boxShadow: `0 10px 24px hsl(${b.hue} 55% 55% / 0.30)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: 999,
                    background: `linear-gradient(135deg, hsl(${b.hue} 70% 62%), hsl(${b.hue} 75% 44%))`,
                    boxShadow: `0 3px 8px hsl(${b.hue} 60% 40% / 0.40)`,
                    color: '#ffffff',
                    fontSize: 30,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {b.symbol}
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 26, color: '#8a8a99', display: 'flex' }}>
            getpassly.de
          </div>
        </div>
      </div>
    ),
    size,
  );
}
