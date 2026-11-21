import type { ReactNode } from "react";

/** A round button that shows only an icon; `label` is what screen readers and tooltips say. */
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
