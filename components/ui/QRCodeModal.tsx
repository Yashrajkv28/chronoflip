import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface QRCodeModalProps {
  eventTitle: string;
  shareId: string;
  onClose: () => void;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({ eventTitle, shareId, onClose }) => {
  const [copied, setCopied] = useState(false);
  const viewerUrl = `${window.location.origin}/view/${shareId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(viewerUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = viewerUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-text-primary/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-sm rounded-3xl
                      bg-bg-primary
                      border border-border-soft
                      shadow-hard-lg
                      p-6 sm:p-8
                      animate-[fadeIn_0.2s_ease-out]">

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full
                     text-text-muted hover:text-text-secondary
                     hover:bg-bg-secondary
                     transition-all"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Title */}
        <h2 className="text-lg font-bold text-text-primary text-center mb-1">
          Share
        </h2>
        <p className="text-sm text-text-secondary text-center mb-6 truncate">
          {eventTitle}
        </p>

        {/* QR Code */}
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-white rounded-2xl border border-border-soft">
            <QRCodeSVG
              value={viewerUrl}
              size={200}
              level="M"
              bgColor="#ffffff"
              fgColor="#18181b"
            />
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-text-secondary text-center mb-5">
          Participants can scan this code to view the live timer
        </p>

        {/* Copy Link Button */}
        <button
          type="button"
          onClick={handleCopy}
          className="w-full py-3 rounded-2xl text-sm font-semibold
                     bg-accent-blue text-white
                     border border-accent-blue
                     shadow-hard-sm hover:shadow-hard
                     active:scale-[0.98]
                     transition-all duration-200
                     flex items-center justify-center gap-2"
        >
          {copied ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              Copy Viewer Link
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default QRCodeModal;
