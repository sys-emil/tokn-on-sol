import Link from 'next/link';

const VARIANTS = {
  default: '/passly-logo.svg',
  'on-accent': '/passly-logo-on-accent.svg',
} as const;

interface PasslyLogoProps {
  height?: number;
  variant?: keyof typeof VARIANTS;
  asLink?: boolean;
}

export function PasslyLogo({ height = 30, variant = 'default', asLink = true }: PasslyLogoProps) {
  const width = Math.round(height * (330 / 92));
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={VARIANTS[variant]}
      alt="Passly"
      height={height}
      width={width}
      style={{ display: 'block' }}
    />
  );
  if (!asLink) return img;
  return (
    <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}>
      {img}
    </Link>
  );
}
