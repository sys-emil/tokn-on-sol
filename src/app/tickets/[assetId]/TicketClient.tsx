'use client';

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export default function TicketClient({ qrToken }: { qrToken: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    void QRCode.toCanvas(canvasRef.current, qrToken, {
      width: 260,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#1a1c26', light: '#f5f3ee' },
    });
  }, [qrToken]);

  return <canvas ref={canvasRef} width={260} height={260} style={{ display: 'block' }} />;
}
