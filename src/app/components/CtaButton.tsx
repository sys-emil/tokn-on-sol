'use client';

import { useLogin, useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { postLoginDestination } from '@/lib/postLogin';

interface CtaButtonProps {
  className?: string;
}

// Deliberately no auto-redirect for authenticated visitors; logged-in users
// must be able to browse the landing page (logo links back to "/"). Only an
// actively completed login (onComplete) navigates onwards — ins Dashboard bei
// freigeschalteten Veranstaltern, sonst zur Ticketuebersicht.
export default function CtaButton({ className }: CtaButtonProps) {
  const { ready, authenticated } = useAuth();
  const router = useRouter();
  const go = () => { void postLoginDestination().then((to) => router.push(to)); };
  const { login } = useLogin({ onComplete: go });

  function handleClick() {
    if (authenticated) {
      go();
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
