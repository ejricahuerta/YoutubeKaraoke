"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** QR code for a URL, always dark-on-white so phone cameras read it reliably. Size comes from `className`. */
export function QrCode({ url, className = "" }: { url: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    QRCode.toDataURL(url, { width: 640, margin: 2, errorCorrectionLevel: "M", color: { dark: "#0b0a10", light: "#ffffff" } })
      .then((data) => !cancelled && setSrc(data))
      .catch(() => !cancelled && setSrc(null));
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className={`aspect-square shrink-0 overflow-hidden bg-white ${className}`}>
      {src && url ? <img src={src} alt="QR code to join this karaoke session" className="h-full w-full" /> : null}
    </div>
  );
}
