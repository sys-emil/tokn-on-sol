import Link from 'next/link';

export function PasslyLogo({ height = 30 }: { height?: number }) {
  const width = Math.round(height * (500 / 120));
  return (
    <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/passly-logo.svg" alt="Passly" height={height} width={width} style={{ display: 'block' }} />
    </Link>
  );
}
