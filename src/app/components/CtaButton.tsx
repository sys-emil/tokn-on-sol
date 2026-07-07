'use client';

import { useLogin, usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';

interface CtaButtonProps {
  className?: string;
}

// Deliberately no auto-redirect for authenticated visitors — logged-in users
// must be able to browse the landing page (logo links back to "/"). Only an
// actively completed login (onComplete) navigates to the ticket overview.
export default function CtaButton({ className }: CtaButtonProps) {
  const { ready, authenticated } = usePrivy();
  const router = useRouter();
  const { login } = useLogin({
    onComplete: () => router.push('/my-tickets'),
  });

  function handleClick() {
    if (authenticated) {
      router.push('/my-tickets');
      return;
    }
    login();
  }

  return (
    <button className={className} onClick={handleClick} disabled={!ready}>
      Loslegen
      <span className="cta-arrow">→</span>
    </button>
  );
}
