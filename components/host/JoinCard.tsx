import { QrCode } from "../QrCode";

/** How a guest gets in: the join page's address, the same address without the scheme, and the session code. */
export type JoinInfo = { joinUrl: string; joinHost: string; code: string };

/** QR code, address and session code: shown in the queue panel while a song is on. */
export function JoinCard({ joinUrl, joinHost, code }: JoinInfo) {
  return (
    <div className="flex shrink-0 items-center gap-6 rounded-card bg-stage-200 p-5">
      <QrCode url={joinUrl} className="w-[10rem] rounded-row" />
      <div className="min-w-0">
        <p className="text-[1.5rem] font-medium leading-[1.875rem] text-ink-muted">Scan to add songs, or go to</p>
        {/* Sized so the address stays on one line; a longer one is cut short rather than wrapped. */}
        <p className="mt-1 truncate text-[1.5rem] font-bold leading-8" title={joinHost}>{joinHost}</p>
        <p className="mt-3 font-mono text-[2.75rem] leading-none tracking-[0.12em]">{code}</p>
      </div>
    </div>
  );
}

/** The small QR code in a corner of the video, for when the queue panel is hidden or in full screen. */
export function JoinCorner({ joinUrl, code }: Pick<JoinInfo, "joinUrl" | "code">) {
  return (
    <div className="pointer-events-none absolute bottom-7 right-7 flex flex-col items-center gap-2 rounded-card bg-stage-000 p-3 shadow-lift">
      <QrCode url={joinUrl} className="w-[9rem] rounded-row" />
      <span className="font-mono text-[1.5rem] leading-none tracking-[0.12em]">{code}</span>
    </div>
  );
}
