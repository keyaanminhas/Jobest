"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

export function QrCode({ value, size = 200 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function generate() {
      try {
        const url = await QRCode.toDataURL(value, {
          width: size,
          margin: 1,
          color: {
            dark: "#162238",
            light: "#ffffff",
          },
        });
        if (!cancelled) {
          setDataUrl(url);
        }
      } catch {
        if (!cancelled) {
          setDataUrl("");
        }
      }
    }
    void generate();
    return () => {
      cancelled = true;
    };
  }, [size, value]);

  if (!dataUrl) {
    return <div className="grid place-items-center rounded-2xl border border-slate-200 bg-white text-xs text-slate-500" style={{ width: size, height: size }}>QR loading...</div>;
  }

  return <img src={dataUrl} alt="Job application QR code" width={size} height={size} className="rounded-2xl border border-slate-200 bg-white p-2" />;
}
