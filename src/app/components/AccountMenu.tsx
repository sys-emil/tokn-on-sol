'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/app/components/passlyUi';

/**
 * Clickable avatar in the topbar: opens a small menu with account editing,
 * the own public profile, and logout. Replaces the bare initials circle.
 */
export function AccountMenu({
  email,
  walletAddress,
  onLogout,
}: {
  email: string;
  walletAddress?: string;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const initials = (email ? email.split('@')[0] : 'PA').slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <style>{`
        .acct-avatar-btn {
          display: grid; place-items: center;
          padding: 0; border-radius: 50%;
          transition: box-shadow 0.15s, transform 0.15s;
        }
        .acct-avatar-btn:hover { transform: scale(1.05); box-shadow: 0 0 0 3px var(--accent-wash); }
        .acct-menu {
          position: absolute; right: 0; top: calc(100% + 8px);
          min-width: 224px;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 12px;
          box-shadow: 0 12px 40px rgba(17,20,45,0.14), 0 2px 8px rgba(17,20,45,0.06);
          padding: 6px;
          z-index: 60;
          animation: slideUp 0.16s cubic-bezier(.2,.8,.2,1);
        }
        .acct-menu .who {
          padding: 9px 10px 10px;
          border-bottom: 1px solid var(--line);
          margin-bottom: 6px;
        }
        .acct-menu .who .mail { font-size: 12.5px; font-weight: 600; letter-spacing: -0.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .acct-menu .who .sub { font-size: 11px; color: var(--ink-3); margin-top: 2px; }
        .acct-menu a, .acct-menu button.item {
          display: flex; align-items: center; gap: 9px;
          width: 100%;
          padding: 8px 10px;
          font-size: 13px; font-weight: 500; color: var(--ink-2);
          border-radius: 8px;
          text-align: left;
        }
        .acct-menu a:hover, .acct-menu button.item:hover { background: var(--surface-2); color: var(--ink); }
        .acct-menu .item-icon { color: var(--ink-3); display: grid; place-items: center; }
        @media (prefers-reduced-motion: reduce) { .acct-menu { animation: none; } }
      `}</style>
      <button
        className="acct-avatar-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={email}
      >
        <span className="avatar" style={{ cursor: 'pointer' }}>{initials}</span>
      </button>
      {open && (
        <div className="acct-menu" role="menu">
          <div className="who">
            <div className="mail">{email || 'Angemeldet'}</div>
            <div className="sub">Dein Passly-Konto</div>
          </div>
          <Link href="/account" role="menuitem" onClick={() => setOpen(false)}>
            <span className="item-icon"><Icon name="settings" size={14} /></span>
            Konto &amp; Profil bearbeiten
          </Link>
          {walletAddress && (
            <Link href={`/collection/${walletAddress}`} role="menuitem" onClick={() => setOpen(false)}>
              <span className="item-icon"><Icon name="users" size={14} /></span>
              Öffentliches Profil ansehen
            </Link>
          )}
          <button className="item" role="menuitem" onClick={() => { setOpen(false); onLogout(); }}>
            <span className="item-icon"><Icon name="x" size={14} /></span>
            Abmelden
          </button>
        </div>
      )}
    </div>
  );
}
