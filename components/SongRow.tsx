import type { ReactNode } from "react";
import { formatDuration } from "@/lib/format";

/** One song line: a thumbnail (or a custom leading element), title, a secondary line, and trailing actions. */
export function SongRow({
  thumbnailUrl,
  leading,
  title,
  subtitle,
  durationSeconds,
  actions,
  className = "",
}: {
  thumbnailUrl?: string;
  /** Replaces the thumbnail, e.g. a singer avatar in the queue. */
  leading?: ReactNode;
  title: string;
  subtitle: ReactNode;
  durationSeconds?: number;
  actions?: ReactNode;
  className?: string;
}) {
  const duration = formatDuration(durationSeconds ?? 0);
  return (
    <div className={`flex items-center gap-3 rounded-row p-2 ${className}`}>
      {leading ?? (
        <div className="relative h-[3.25rem] w-[5.5rem] shrink-0 overflow-hidden rounded-lg bg-stage-300">
          {thumbnailUrl ? <img src={thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
          {duration ? (
            <span className="absolute bottom-[3px] right-[3px] rounded bg-stage-000 px-1 text-[0.6875rem] font-semibold leading-[0.875rem] tabular-nums text-ink">
              {duration}
            </span>
          ) : null}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-base font-medium leading-[1.3] text-ink">{title}</p>
        <p className="mt-0.5 truncate text-[0.8125rem] font-semibold leading-[1.4] text-ink-muted">{subtitle}</p>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </div>
  );
}

export function IconButton({
  label,
  onClick,
  children,
  className = "",
  disabled,
  size = "md",
}: {
  /** "lg" is for the main-screen transport controls, sized to be hit from across a room. */
  size?: "md" | "lg";
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`grid shrink-0 place-items-center rounded-full text-ink transition active:scale-95 disabled:opacity-40 ${
        size === "lg" ? "h-24 w-24 hover:bg-stage-200 disabled:hover:bg-transparent" : "h-11 w-11 bg-stage-200 hover:bg-stage-300"
      } ${className}`}
    >
      {children}
    </button>
  );
}
