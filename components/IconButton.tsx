import type { ReactNode } from "react";

/** A round button that shows only an icon; `label` is what screen readers and tooltips say. */
export function IconButton({
  label,
  onClick,
  children,
  className = "",
  disabled,
  primary = false,
}: {
  label: string;
  /** Filled with the brand colour, for the one action a row most invites. */
  primary?: boolean;
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
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition active:scale-95 disabled:opacity-40 ${
        primary ? "bg-encore text-on-encore hover:bg-encore-hover" : "bg-stage-200 text-ink hover:bg-stage-300"
      } ${className}`}
    >
      {children}
    </button>
  );
}
