"use client";

import Link from "next/link";
import { useCallback, useState, type FormEvent } from "react";
import { useStoredString } from "@/lib/browser-hooks";
import { sessionRequest, useSessionState } from "@/lib/useSessionState";
import { Credit } from "./Credit";
import { CenteredMessage } from "./HostScreen";
import { MicIcon } from "./icons";
import { QueuePanel } from "./QueuePanel";
import { SearchPanel } from "./SearchPanel";
import { SongRow } from "./SongRow";

export function GuestScreen({ code }: { code: string }) {
  const { state, status, refresh } = useSessionState(code);
  const [name, setName] = useStoredString("karaoke:name");
  const [draftName, setDraftName] = useState("");
  const [tab, setTab] = useState<"search" | "queue">("search");

  const remove = useCallback(
    async (id: string) => {
      await sessionRequest(`/api/sessions/${code}/queue/${id}`, "DELETE");
      refresh();
    },
    [code, refresh],
  );

  if (status === "archived") {
    return (
      <CenteredMessage title="This session has ended">
        Ask the host to start a new one, then scan its QR code.
      </CenteredMessage>
    );
  }
  if (status === "not_found") {
    return (
      <CenteredMessage title="Session not found">
        This karaoke session has ended, or the code is wrong. Scan the QR code on the screen again, or{" "}
        <Link href="/" className="text-rose-400 underline">go to the start page</Link>.
      </CenteredMessage>
    );
  }
  if (!state || name === undefined) {
    return (
      <CenteredMessage title={status === "error" ? "Can't reach the server" : "Loading…"}>
        {status === "error" ? "Check your connection. This page will keep retrying." : null}
      </CenteredMessage>
    );
  }

  if (!name) {
    const submit = (e: FormEvent) => {
      e.preventDefault();
      if (draftName.trim()) setName(draftName.trim().slice(0, 40));
    };
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm">
          <span className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-rose-600"><MicIcon /></span>
          <h1 className="text-2xl font-bold">Join the karaoke</h1>
          <p className="mt-1 text-neutral-400">Your name is shown next to the songs you pick.</p>
          <label htmlFor="name" className="mt-6 block text-sm font-medium text-neutral-300">Your name</label>
          <input
            id="name"
            autoFocus
            autoComplete="given-name"
            maxLength={40}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 text-base text-white focus:border-rose-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!draftName.trim()}
            className="mt-4 h-12 w-full rounded-full bg-rose-600 text-base font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
          >
            Continue
          </button>
          <Credit className="mt-8 text-center" />
        </form>
      </div>
    );
  }

  const current = state.current;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-xl flex-col">
      <header className="border-b border-white/10 px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-bold">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-rose-600"><MicIcon className="h-4 w-4" /></span>
            Karaoke <span className="font-mono text-sm font-medium tracking-widest text-neutral-400">{code}</span>
          </div>
          <button type="button" onClick={() => setName(null)} className="truncate text-sm text-neutral-400 underline-offset-2 hover:underline">
            {name} · change
          </button>
        </div>
        {current ? (
          <SongRow
            thumbnailUrl={current.thumbnailUrl}
            title={current.title}
            subtitle={<><span className="text-rose-400">{state.isPlaying ? "Now singing" : "Paused"}</span> · {current.addedBy}</>}
            durationSeconds={current.durationSeconds}
            className="mt-3 bg-white/5"
          />
        ) : (
          <p className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-sm text-neutral-400">
            Nothing is playing. The first song you add starts right away.
          </p>
        )}
        <div className="mt-3 flex gap-2" role="tablist">
          {([["search", "Find a song"], ["queue", `Up next (${state.queue.length})`]] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`h-10 flex-1 rounded-full text-sm font-medium transition ${
                tab === id ? "bg-white text-black" : "bg-white/10 text-neutral-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
        {tab === "search" ? (
          <SearchPanel code={code} name={name} onAdded={refresh} />
        ) : (
          <QueuePanel queue={state.queue} isHost={false} onRemove={remove} emptyText="No songs waiting. Add one from Find a song." />
        )}
      </div>
      <Credit className="border-t border-white/10 py-2 text-center" />
    </div>
  );
}
