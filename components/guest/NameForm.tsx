"use client";

import { useState, type FormEvent } from "react";
import { normalizeSingerName, SINGER_NAME_MAX_LENGTH } from "@/lib/domain/singers";
import { Avatar } from "../Avatar";
import { Credit } from "../Credit";
import { Logo } from "../Logo";

/** The first thing a guest sees: pick the name the room will read on the main screen. */
export function NameForm({
  code,
  initialName = "",
  onSubmit,
  onCancel,
}: {
  code: string;
  /** The name to start from when changing an existing one. */
  initialName?: string;
  onSubmit: (name: string) => void;
  /** Present when there is a name to go back to. */
  onCancel?: () => void;
}) {
  const [draftName, setDraftName] = useState(initialName);
  const name = normalizeSingerName(draftName);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name) onSubmit(name);
  };

  return (
    <form onSubmit={submit} className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 pb-6 pt-5">
      <div className="flex items-center justify-between">
        <Logo />
        <span className="rounded-full bg-stage-200 px-3 py-2 font-mono text-base tracking-[0.14em]">{code}</span>
      </div>
      <div className="flex flex-1 flex-col justify-center gap-6">
        <Avatar name={draftName} className="h-24 w-24 font-display text-5xl font-extrabold transition-colors" />
        <div>
          <h1 className="font-display text-[2.5rem] font-extrabold leading-none tracking-tight">What should we call you?</h1>
          <p className="mt-2 text-base text-ink-muted">Your name shows on the big screen when it&apos;s your turn.</p>
        </div>
        <div>
          <label htmlFor="name" className="block text-sm font-semibold text-ink-muted">Your name</label>
          <input
            id="name"
            autoFocus
            autoComplete="given-name"
            maxLength={SINGER_NAME_MAX_LENGTH}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            className="mt-2 h-14 w-full rounded-row border-2 border-line-strong bg-stage-200 px-5 text-xl font-semibold text-ink focus:border-spotlight focus:outline-none"
          />
        </div>
      </div>
      <div>
        <button
          type="submit"
          disabled={!name}
          className="h-14 w-full rounded-full bg-encore text-lg font-bold text-on-encore transition hover:bg-encore-hover active:scale-[0.98] disabled:opacity-40"
        >
          {onCancel ? "Save name" : "Join and pick a song"}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="mt-2 h-12 w-full rounded-full text-base font-semibold text-ink-muted transition hover:text-ink">
            Keep {initialName}
          </button>
        ) : null}
        <Credit className="mt-4 text-center" />
      </div>
    </form>
  );
}
