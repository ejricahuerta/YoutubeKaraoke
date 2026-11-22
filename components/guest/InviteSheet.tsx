"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { inviteLinks, inviteText } from "@/lib/domain/invite";
import { CloseIcon } from "../Icons";
import { IconButton } from "../IconButton";
import { QrCode } from "../QrCode";

/**
 * Invite a friend (#51): the phone's own share sheet when it has one, which reaches every
 * app on the phone; a button for each common messaging app; copying the link; and the
 * room's QR code for someone standing next to you. A native <dialog>, so focus, Escape and
 * the backdrop behave as the platform expects.
 */
const noopSubscribe = () => () => {};

export function InviteSheet({ code, joinUrl, open, onClose }: { code: string; joinUrl: string; open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState<"copied" | "failed" | null>(null);
  // Whether this browser has a share sheet; false on the server and in browsers without one.
  const canShare = useSyncExternalStore(noopSubscribe, () => typeof navigator.share === "function", () => false);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  const close = () => {
    setCopied(null);
    onClose();
  };

  const share = () =>
    navigator.share({ title: `Karaoke: room ${code}`, text: inviteText(code), url: joinUrl }).catch(() => {
      // Cancelled, or the sheet failed: the other options are still on screen.
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="invite-title"
      onClose={close}
      onClick={(e) => e.target === e.currentTarget && close()}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-card bg-stage-100 p-5 text-ink backdrop:bg-black/70"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="invite-title" className="font-display text-2xl font-extrabold">Invite a friend</h2>
          <p className="mt-1 text-sm text-ink-muted">They can join room <span className="font-mono tracking-[0.1em] text-ink">{code}</span> from their phone.</p>
        </div>
        <IconButton label="Close" onClick={close}>
          <CloseIcon />
        </IconButton>
      </div>

      {canShare ? (
        <button
          type="button"
          onClick={share}
          className="mt-5 h-14 w-full rounded-full bg-encore text-lg font-bold text-on-encore transition hover:bg-encore-hover active:scale-[0.98]"
        >
          Share…
        </button>
      ) : null}

      <ul className="mt-4 grid grid-cols-2 gap-2">
        {inviteLinks(joinUrl, code).map((link) => (
          <li key={link.id}>
            <a
              href={link.href}
              target={link.href.startsWith("https:") ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="flex h-12 items-center justify-center rounded-full bg-stage-200 px-4 text-base font-semibold transition hover:bg-stage-300"
            >
              {link.label}
            </a>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={copy}
            className="h-12 w-full rounded-full bg-stage-200 px-4 text-base font-semibold transition hover:bg-stage-300"
          >
            Copy link
          </button>
        </li>
      </ul>
      <p role="status" className="mt-2 min-h-5 text-center text-sm font-semibold text-spotlight">
        {copied === "copied" ? "Link copied" : copied === "failed" ? "Couldn't copy. Press and hold the link below to copy it." : ""}
      </p>

      <div className="mt-3 flex items-center gap-4 rounded-row bg-stage-200 p-3">
        <QrCode url={joinUrl} className="w-28 rounded-row" />
        <div className="min-w-0">
          <p className="text-sm text-ink-muted">Or let them scan this</p>
          <p className="font-mono text-2xl tracking-[0.12em]">{code}</p>
          <p className="mt-1 select-all break-all text-xs text-ink-muted">{joinUrl}</p>
        </div>
      </div>
    </dialog>
  );
}
