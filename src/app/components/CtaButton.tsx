'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface CtaButtonProps {
  className?: string;
}

export default function CtaButton({ className }: CtaButtonProps) {
  const { ready, authenticated, login } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (authenticated) router.push('/dashboard');
  }, [authenticated]);

  function handleClick() {
    if (authenticated) {
      router.push('/dashboard');
      return;
    }
    login();
  }

  return (
    <button className={className} onClick={handleClick} disabled={!ready}>
      Get Started
      <span className="cta-arrow">→</span>
    </button>
  );
}
