"use client";

import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import type { RemoteStatus } from "@/lib/domain/types";
import { ChevronDownIcon, PowerIcon, QueueIcon, SettingsIcon, TurnsIcon, VolumeIcon } from "../Icons";
import { RemoteIndicator } from "./RemoteIndicator";

/** Marks the controls that up and down move between. */
const ITEM_ATTRIBUTE = "data-settings-item";
const ITEM_ROW = "flex h-[4.5rem] w-full items-center gap-4 rounded-row px-[1.125rem] text-left text-[1.5rem] font-semibold transition";

/**
 * The main screen's less used controls, behind one button (docs/adr/0023). A disclosure rather
 * than an ARIA menu, because it holds a slider and a switch. Up and down move between its
 * controls, as a TV remote expects; Escape or a press outside closes it.
 *
 * Volume, taking turns, the remote and ending the session are the host's; any screen can hide
 * the queue.
 */
export function SettingsMenu({
  isHost,
  volume,
  onVolume,
  takeTurns,
  onTakeTurns,
  remote,
  remoteName,
  onFreeRemote,
  showQueue,
  queueLength,
  onToggleQueue,
  onEndSession,
}: {
  isHost: boolean;
  volume: number;
  onVolume: (volume: number) => void;
  takeTurns: boolean;
  onTakeTurns: (on: boolean) => void;
  /** Who has the phone remote, and a way to free it (migration 0012). */
  remote: RemoteStatus;
  remoteName: string | null;
  onFreeRemote: () => void;
  showQueue: boolean;
  queueLength: number;
  onToggleQueue: () => void;
  /** Asks first: the menu only hands over, it does not end anything itself. */
  onEndSession: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>(`[${ITEM_ATTRIBUTE}]`)?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      return close();
    }
    // Up and down move between controls; on the volume slider, left and right still change it.
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!step || !panelRef.current) return;
    e.preventDefault();
    const items = [...panelRef.current.querySelectorAll<HTMLElement>(`[${ITEM_ATTRIBUTE}]`)];
    const index = items.indexOf(document.activeElement as HTMLElement);
    items[(index + step + items.length) % items.length]?.focus();
  }

  const item = { [ITEM_ATTRIBUTE]: "" };
  return (
    <div ref={rootRef} className="relative" onKeyDown={open ? onKeyDown : undefined}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-14 items-center gap-3 rounded-full pl-6 pr-5 text-[1.5rem] font-semibold transition hover:bg-stage-300 active:scale-[0.97] ${
          open ? "bg-stage-300" : "bg-stage-200"
        }`}
      >
        <SettingsIcon className="h-7 w-7" />
        Settings
        <ChevronDownIcon className={`h-6 w-6 transition ${open ? "rotate-180" : ""}`} />
      </button>

      <div
        ref={panelRef}
        id={panelId}
        role="group"
        aria-label="Settings"
        hidden={!open}
        className="absolute right-0 top-[calc(100%+0.75rem)] z-30 flex w-[29rem] flex-col gap-1 rounded-card bg-stage-200 p-3 shadow-lift"
      >
        {open ? (
          <>
            {isHost ? (
              <label className={ITEM_ROW}>
                <VolumeIcon className="h-[1.875rem] w-[1.875rem] shrink-0" />
                Volume
                <input
                  {...item}
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  aria-label="Volume"
                  onChange={(e) => onVolume(Number(e.target.value))}
                  className="h-2.5 min-w-0 flex-1 cursor-pointer accent-ink"
                />
              </label>
            ) : null}
            {isHost ? (
              <MenuButton
                {...item}
                role="switch"
                aria-checked={takeTurns}
                title="With 3 or more people, everyone sings once before anyone sings again"
                onClick={() => onTakeTurns(!takeTurns)}
                icon={<TurnsIcon className="h-[1.875rem] w-[1.875rem]" />}
              >
                <span className="flex-1">Take turns</span>
                <span aria-hidden="true" className={`relative h-8 w-14 shrink-0 rounded-full transition ${takeTurns ? "bg-encore" : "bg-stage-000"}`}>
                  <span className={`absolute top-1 h-6 w-6 rounded-full transition-all ${takeTurns ? "left-7 bg-stage-000" : "left-1 bg-ink-muted"}`} />
                </span>
              </MenuButton>
            ) : null}
            {isHost ? <RemoteIndicator remote={remote} name={remoteName} onFree={onFreeRemote} itemProps={item} /> : null}
            <MenuButton
              {...item}
              aria-controls="queue-panel"
              aria-expanded={showQueue}
              onClick={() => {
                onToggleQueue();
                close();
              }}
              icon={<QueueIcon className="h-[1.875rem] w-[1.875rem]" />}
            >
              {showQueue ? "Hide queue" : `Show queue (${queueLength})`}
            </MenuButton>
            {isHost ? (
              <>
                <div aria-hidden="true" className="mx-3 my-1.5 h-px bg-line" />
                <MenuButton
                  {...item}
                  aria-haspopup="dialog"
                  onClick={() => {
                    setOpen(false);
                    onEndSession();
                  }}
                  icon={<PowerIcon className="h-[1.875rem] w-[1.875rem]" />}
                  className="text-danger"
                >
                  End session
                </MenuButton>
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

function MenuButton({
  icon,
  children,
  className = "",
  ...rest
}: { icon: ReactNode; children: ReactNode; className?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...rest} className={`${ITEM_ROW} hover:bg-stage-300 ${className}`}>
      {icon}
      {children}
    </button>
  );
}
