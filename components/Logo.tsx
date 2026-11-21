/**
 * The YouOke mark: a K whose stem is a singer, with the sing-along ball for a head.
 * `app/icon.svg` and the files in `public/icons` are the same drawing.
 */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={`shrink-0 ${className}`}>
      <rect width="64" height="64" rx="15" className="fill-encore" />
      <circle cx="21" cy="15.5" r="6.5" className="fill-spotlight" />
      <rect x="16" y="26" width="10" height="28" rx="1.5" className="fill-on-encore" />
      <path d="M47.5 29.5 29 40l18.5 10.5" fill="none" strokeWidth="10" strokeLinejoin="miter" className="stroke-on-encore" />
    </svg>
  );
}

/** The mark, optionally followed by the wordmark. Sizes come from the class props. */
export function Logo({
  mark = "h-8 w-8",
  word = "text-[1.375rem]",
  label,
}: {
  mark?: string;
  word?: string;
  /** Text to show instead of the wordmark, e.g. a screen title. Pass null for the mark alone. */
  label?: string | null;
}) {
  return (
    <span className="flex items-center gap-[0.625em]">
      <LogoMark className={mark} />
      {label === null ? null : (
        <span className={`font-display font-extrabold tracking-tight ${word}`}>
          {label ?? <>You<span className="text-encore">Oke</span></>}
        </span>
      )}
    </span>
  );
}
