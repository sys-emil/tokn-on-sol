'use client';

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export default function TicketClient({ qrToken }: { qrToken: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    void QRCode.toCanvas(canvasRef.current, qrToken, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: '#1a1c26', light: '#f5f3ee' },
    });
  }, [qrToken]);

  return <canvas ref={canvasRef} width={220} height={220} style={{ display: 'block' }} />;
}
