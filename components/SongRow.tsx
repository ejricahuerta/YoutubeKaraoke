import type { ReactNode } from "react";
import { formatDuration } from "@/lib/format";

/** One song line: thumbnail, title, a secondary line, and trailing actions. */
export function SongRow({
  thumbnailUrl,
  title,
  subtitle,
  durationSeconds,
  actions,
  className = "",
}: {
  thumbnailUrl: string;
  title: string;
  subtitle: ReactNode;
  durationSeconds: number;
  actions?: ReactNode;
  className?: string;
}) {
  const duration = formatDuration(durationSeconds);
  return (
    <div className={`flex items-center gap-3 rounded-lg p-2 ${className}`}>
      <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md bg-neutral-800">
        {thumbnailUrl ? <img src={thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
        {duration ? (
          <span className="absolute bottom-0.5 right-0.5 rounded bg-black/80 px-1 text-[10px] font-medium tabular-nums text-white">
            {duration}
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-neutral-100">{title}</p>
        <p className="mt-0.5 truncate text-xs text-neutral-400">{subtitle}</p>
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
}: {
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
      className={`grid h-10 w-10 place-items-center rounded-full text-neutral-300 transition hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent ${className}`}
    >
      {children}
    </button>
  );
}
