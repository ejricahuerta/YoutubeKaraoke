"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Asks before something that cannot be taken back (docs/adr/0023). A modal dialog: the rest
 * of the screen is inert while it is open, Escape or a press outside it cancels, and Cancel
 * has the focus, so a second press of a remote's OK button never confirms by accident.
 */
export function ConfirmDialog({
  title,
  children,
  cancelLabel = "Cancel",
  confirmLabel,
  confirmIcon,
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  cancelLabel?: string;
  confirmLabel: string;
  confirmIcon?: ReactNode;
  /** The confirm button is red, for actions that end something for everyone. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // Opened on mount and closed on unmount; the parent decides when it shows by rendering it.
  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement as HTMLElement | null;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      dialog?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault(); // Escape: let the parent close it, so its state stays the truth
        onCancel();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel(); // a press on the backdrop
      }}
      className="m-auto w-[47.5rem] max-w-[calc(100vw-2rem)] rounded-panel border-0 bg-stage-100 p-0 text-ink shadow-lift backdrop:bg-stage-000/70"
    >
      <div className="flex flex-col gap-7 p-12">
        <h2 id={titleId} className="font-display text-[2.75rem] font-bold leading-[1.05] tracking-tight">{title}</h2>
        {children}
        <div className="flex flex-wrap justify-end gap-4">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            className="h-[4.5rem] rounded-full bg-stage-300 px-9 text-[1.625rem] font-bold transition hover:bg-stage-200 active:scale-[0.97]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex h-[4.5rem] items-center gap-3 rounded-full pl-7 pr-9 text-[1.625rem] font-bold transition active:scale-[0.97] ${
              danger ? "bg-danger text-stage-000 hover:brightness-110" : "bg-encore text-on-encore hover:bg-encore-hover"
            }`}
          >
            {confirmIcon}
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
