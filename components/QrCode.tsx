"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** QR code for a URL, always dark-on-white so phone cameras read it reliably. */
export function QrCode({ url, size, className = "" }: { url: string; size: number; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { width: size * 2, margin: 1, errorCorrectionLevel: "M" })
      .then((data) => !cancelled && setSrc(data))
      .catch(() => !cancelled && setSrc(null));
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  return (
    <div className={`shrink-0 rounded-xl bg-white p-2 ${className}`} style={{ width: size, height: size }}>
      {src ? <img src={src} alt="QR code to join this karaoke session" className="h-full w-full" /> : null}
    </div>
  );
}
