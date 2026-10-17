"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type QRCodeModalProps = {
  shortUrl: string;
  shortCode: string;
  onClose: () => void;
};

export default function QRCodeModal({
  shortUrl,
  shortCode,
  onClose,
}: QRCodeModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setQrDataUrl("");
    setError("");

    QRCode.toDataURL(shortUrl, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#201b18", light: "#ffffff" },
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setError("Could not generate the QR code.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [shortUrl]);

  function downloadQr() {
    if (!qrDataUrl) return;

    const anchor = document.createElement("a");
    anchor.href = qrDataUrl;
    anchor.download = `tiny-run-${shortCode}-qr.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-modal-title"
        className="w-full max-w-sm rounded-3xl bg-paper p-6 text-center shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 id="qr-modal-title" className="text-xl font-semibold">
            QR code
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-black/15 px-3 py-2 text-sm"
          >
            Close
          </button>
        </div>

        <p className="mt-4 break-all text-sm text-black/60">{shortUrl}</p>

        <div className="mt-5 flex min-h-64 items-center justify-center rounded-2xl bg-white p-4">
          {loading ? (
            <p className="text-sm text-black/55">Generating QR code...</p>
          ) : error ? (
            <p role="alert" className="text-sm text-red-700">{error}</p>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt={`QR code for ${shortUrl}`}
              width={320}
              height={320}
              className="h-auto w-full max-w-64"
            />
          )}
        </div>

        <button
          type="button"
          onClick={downloadQr}
          disabled={loading || !qrDataUrl}
          className="mt-5 w-full rounded-xl bg-rust px-5 py-3 font-semibold text-white disabled:opacity-50"
        >
          Download QR as PNG
        </button>

        <p className="mt-3 text-xs text-black/45">
          Scan this code to open the shortened link.
        </p>
      </div>
    </div>
  );
}
