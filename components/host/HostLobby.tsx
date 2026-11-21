import { QrCode } from "../QrCode";
import type { JoinInfo } from "./JoinCard";

const STEPS = [
  "Point your phone camera at the code",
  "Type your name and search for a song",
  "Tap add. It plays here on your turn",
];

/** The main screen before the first song: how to join, as large as it can be. */
export function HostLobby({ joinUrl, joinHost, code }: JoinInfo) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-10 p-10 sm:flex-row sm:gap-16">
      <div className="flex min-w-0 flex-col gap-9">
        <h1 className="font-display text-[7.5rem] font-extrabold leading-[0.92] tracking-[-0.03em]">
          Scan.<br />Pick.<br /><span className="text-encore">Sing.</span>
        </h1>
        <ol className="flex flex-col gap-4">
          {STEPS.map((step, index) => (
            <li key={step} className="flex items-center gap-5 text-[1.625rem] font-medium">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-stage-300 text-[1.5rem] font-bold">{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </div>
      <div className="flex shrink-0 flex-col items-center gap-6 rounded-panel bg-stage-200 p-9">
        <QrCode url={joinUrl} className="w-[21rem] rounded-card" />
        <p className="max-w-[24rem] text-center text-[1.5rem] font-medium leading-[1.875rem] text-ink-muted">
          No camera? Go to
          <span className="block font-bold text-ink [overflow-wrap:anywhere]">{joinHost}</span>
          and enter
        </p>
        <p className="font-mono text-[4.5rem] leading-none tracking-[0.14em] [margin-right:-0.14em]">{code}</p>
      </div>
    </div>
  );
}
