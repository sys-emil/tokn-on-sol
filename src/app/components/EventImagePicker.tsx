'use client';

import { useAuth } from '@/lib/auth';
import { useRef, useState } from 'react';
import { Icon } from '@/app/components/passlyUi';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 4 * 1024 * 1024;

const PICKER_CSS = `
  .imgpick { display: flex; flex-wrap: wrap; gap: 10px; }
  .imgpick-item {
    position: relative; width: 92px; height: 62px; border-radius: 10px;
    overflow: hidden; border: 1px solid var(--line); background: var(--surface-3);
  }
  .imgpick-item img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .imgpick-remove {
    position: absolute; top: 4px; right: 4px;
    width: 22px; height: 22px; border-radius: 6px; border: none; cursor: pointer;
    display: grid; place-items: center;
    background: rgba(11, 8, 26, 0.72); color: #fff;
  }
  .imgpick-remove:hover { background: var(--bad); }
  .imgpick-add {
    width: 92px; height: 62px; border-radius: 10px; cursor: pointer;
    border: 1px dashed var(--line-2); background: var(--surface);
    color: var(--ink-3); display: grid; place-items: center;
    transition: border-color 0.15s, color 0.15s;
  }
  .imgpick-add:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
  .imgpick-add:disabled { opacity: 0.5; cursor: default; }
`;

/**
 * Bild-Upload fuer Event-Titelbild (max = 1) und Showcase-Galerie (max = 8).
 *
 * Laedt beim Auswaehlen sofort hoch — wie der Profil-Editor — statt erst beim
 * Speichern: nur so funktioniert dasselbe Feld in der Anlege- und in der
 * Bearbeiten-Schublade. Der Aufrufer haelt danach nur noch URLs.
 */
export function EventImagePicker({
  urls,
  onChange,
  ownerWallet,
  max,
  disabled,
  onError,
}: {
  urls: string[];
  onChange: (urls: string[]) => void;
  ownerWallet: string;
  max: number;
  disabled?: boolean;
  onError: (message: string | null) => void;
}) {
  const { getAccessToken } = useAuth();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const full = urls.length >= max;

  async function handleFiles(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return;
    onError(null);

    const picked = Array.from(files).slice(0, max - urls.length);
    for (const file of picked) {
      if (!ALLOWED.includes(file.type)) {
        onError('Bilder müssen JPEG, PNG oder WebP sein.');
        return;
      }
      if (file.size > MAX_BYTES) {
        onError(`„${file.name}" ist größer als 4 MB.`);
        return;
      }
    }

    setUploading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        onError('Nicht angemeldet. Bitte melde dich ab und wieder an.');
        return;
      }
      const uploaded: string[] = [];
      for (const file of picked) {
        const form = new FormData();
        form.append('organizer_wallet', ownerWallet);
        form.append('file', file);
        const res = await fetch('/api/events/upload-image', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        const data = (await res.json()) as { success: true; url: string } | { success: false; error: string };
        if (!res.ok || !data.success) {
          onError(`Bild-Upload fehlgeschlagen: ${data.success ? `HTTP ${res.status}` : data.error}`);
          // Bereits hochgeladene Bilder bleiben erhalten, sonst verliert der
          // Veranstalter bei einem Fehler im vierten Bild auch die ersten drei.
          if (uploaded.length > 0) onChange([...urls, ...uploaded]);
          return;
        }
        uploaded.push(data.url);
      }
      onChange([...urls, ...uploaded]);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <>
      <style>{PICKER_CSS}</style>
      <div className="imgpick">
        {urls.map((url) => (
          <div key={url} className="imgpick-item">
            {/* eslint-disable-next-line @next/next/no-img-element -- storage host is env-dependent, skip next/image remotePatterns */}
            <img src={url} alt="" />
            <button
              type="button"
              className="imgpick-remove"
              onClick={() => onChange(urls.filter((u) => u !== url))}
              disabled={disabled || uploading}
              aria-label="Bild entfernen"
            >
              <Icon name="x" size={12} />
            </button>
          </div>
        ))}
        {!full && (
          <button
            type="button"
            className="imgpick-add"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || uploading}
            aria-label="Bild hinzufügen"
          >
            {uploading ? <Icon name="refresh" size={16} /> : <Icon name="plus" size={18} />}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple={max > 1}
          style={{ display: 'none' }}
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>
    </>
  );
}
