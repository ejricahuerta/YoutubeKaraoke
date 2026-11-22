"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useOrigin } from "@/lib/client/browser-hooks";
import { startHandoff, takeOverUrl } from "@/lib/client/session-api";
import { failureMessage } from "@/lib/domain/messages";
import { CloseIcon } from "../Icons";
import { IconButton } from "../IconButton";
import { QrCode } from "../QrCode";

const noopSubscribe = () => () => {};

/**
 * For the remote while the main screen is away (migration 0014): a one-time link that makes
 * whichever big screen opens it the main screen. It works once, for 10 minutes, and only
 * while the main screen stays away. A native <dialog>, like the invite sheet.
 */
export function MoveScreenSheet({ code, open, onClose }: { code: string; open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const origin = useOrigin();
  const [link, setLink] = useState<{ url: string } | { error: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const canShare = useSyncExternalStore(noopSubscribe, () => typeof navigator.share === "function", () => false);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  // A fresh link each time the sheet opens; asking again replaces the last one.
  useEffect(() => {
    if (!open || !origin) return;
    let cancelled = false;
    startHandoff(code).then(({ outcome, token }) => {
      if (cancelled) return;
      setLink(token ? { url: takeOverUrl(origin, code, token) } : { error: failureMessage(outcome, "Couldn't make a link. Try again.") });
    });
    return () => {
      cancelled = true;
    };
  }, [open, origin, code]);

  const close = () => {
    setLink(null);
    setCopied(false);
    onClose();
  };

  const url = link && "url" in link ? link.url : null;

  return (
    <dialog
      ref={dialog}
      aria-labelledby="move-title"
      onClose={close}
      onClick={(e) => e.target === e.currentTarget && close()}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-card bg-stage-100 p-5 text-ink backdrop:bg-black/70"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="move-title" className="font-display text-2xl font-extrabold">Move the main screen</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Open this link on the TV or laptop that should play the songs. It works once, for 10 minutes; the queue comes along.
          </p>
        </div>
        <IconButton label="Close" onClick={close}>
          <CloseIcon />
        </IconButton>
      </div>

      {url ? (
        <>
          <div className="mt-4 flex items-center gap-4 rounded-row bg-stage-200 p-3">
            <QrCode url={url} alt="QR code to open the main screen" className="w-28 rounded-row" />
            <p className="min-w-0 select-all break-all text-xs text-ink-muted">{url}</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                navigator.clipboard.writeText(url).then(
                  () => setCopied(true),
                  () => setCopied(false),
                )
              }
              className="h-12 rounded-full bg-stage-200 px-4 text-base font-semibold transition hover:bg-stage-300"
            >
              Copy link
            </button>
            {canShare ? (
              <button
                type="button"
                onClick={() => navigator.share({ title: `Main screen for room ${code}`, url }).catch(() => {})}
                className="h-12 rounded-full bg-stage-200 px-4 text-base font-semibold transition hover:bg-stage-300"
              >
                Send…
              </button>
            ) : null}
          </div>
          <p role="status" className="mt-2 min-h-5 text-center text-sm font-semibold text-spotlight">{copied ? "Link copied" : ""}</p>
        </>
      ) : (
        <p role="status" className="mt-4 text-sm font-semibold text-notice">{link && "error" in link ? link.error : "Making a link…"}</p>
      )}
    </dialog>
  );
}
