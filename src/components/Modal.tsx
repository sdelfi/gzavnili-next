"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import "./Modal.css";

// React port of what the featherlight jQuery plugin used to render (see
// http/bower_components/featherlight/src/featherlight.js). Same markup/classes
// (.featherlight / .featherlight-content / .featherlight-close-icon / .featherlight-inner) —
// deliberately no inline styles here beyond `display`, since `public/css/style.css` already
// carries this site's real featherlight overrides (overlay opacity, content padding, and the
// close icon's `icons.png` sprite graphic — see style.css around line 837-863). Modal.css only
// fills in the *structural* rules that plugin provided and this site's CSS never had to
// (position/centering) — it must not re-declare anything style.css already sets, or it'll
// fight the real design instead of matching it.
export function Modal({
  open,
  onClose,
  variant,
  children,
}: {
  open: boolean;
  onClose: () => void;
  variant?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={`featherlight${variant ? ` ${variant}` : ""}`}
      style={{ display: "block" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="featherlight-content">
        {/* text-indent pushes the label off-screen — style.css draws the actual icon via an
            icons.png sprite background, same technique the legacy CSS uses. */}
        <span className="featherlight-close-icon" onClick={onClose}>
          Close
        </span>
        <div className="featherlight-inner">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
