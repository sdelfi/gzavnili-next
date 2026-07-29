"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

// React port of what the featherlight jQuery plugin used to render (see
// http/bower_components/featherlight/src/featherlight.js). Same markup/classes
// (.featherlight / .featherlight-content / .featherlight-close-icon / .featherlight-inner)
// so featherlight.min.css applies unchanged; the open/close behavior is now plain state.
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
      style={{ display: "block", background: "rgba(0,0,0,.8)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="featherlight-content">
        <span className="featherlight-close-icon" onClick={onClose}>
          &#10005;
        </span>
        <div className="featherlight-inner">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
