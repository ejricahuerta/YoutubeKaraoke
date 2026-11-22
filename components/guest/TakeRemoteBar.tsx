"use client";

import { claimRemote } from "@/lib/client/session-api";
import { failureMessage, isFailure } from "@/lib/domain/messages";

/** Shown to every phone while nobody has the remote (migration 0012): the first to tap takes it. */
export function TakeRemoteBar({ code, onDone, onFailed }: { code: string; onDone: () => void; onFailed: (message: string) => void }) {
  const take = async () => {
    const outcome = await claimRemote(code);
    if (outcome === "forbidden") onFailed("Someone else just took the remote.");
    else if (isFailure(outcome)) onFailed(failureMessage(outcome, "Couldn't take the remote. Try again."));
    onDone();
  };

  return (
    <div className="mx-2 mb-2 flex items-center gap-3 rounded-row bg-stage-100 px-3 py-2">
      <p className="min-w-0 flex-1 text-sm font-semibold leading-5 text-ink-muted">Nobody has the remote.</p>
      <button
        type="button"
        onClick={take}
        className="h-11 shrink-0 rounded-full bg-stage-300 px-4 text-sm font-semibold transition hover:bg-line active:scale-[0.97]"
      >
        Use this phone as the remote
      </button>
    </div>
  );
}
