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

/**
 * "YouOke" with the k drawn as the singer from the mark: a short stem with the mic dot on top.
 * The k is sized in em on the font's own grid, so it follows the surrounding text.
 */
function Wordmark() {
  return (
    <span aria-label="YouOke" role="img" className="whitespace-nowrap">
      <span aria-hidden>
        You<span className="text-encore">O</span>
        <svg viewBox="0 0 640 800" className="mx-[0.02em] inline-block h-[0.8em] w-[0.64em] align-baseline">
          <clipPath id="youoke-k"><rect x="0" y="290" width="640" height="510" /></clipPath>
          <circle cx="128" cy="140" r="105" className="fill-spotlight" />
          <rect x="36" y="290" width="184" height="510" rx="20" className="fill-encore" />
          <path d="M575 240 262 545l330 320" fill="none" strokeWidth="182" clipPath="url(#youoke-k)" className="stroke-encore" />
        </svg>
        <span className="text-encore">e</span>
      </span>
    </span>
  );
}

/** The mark, optionally followed by the wordmark. Sizes come from the class props. */
export function Logo({
  mark = "h-8 w-8",
  word = "text-[1.375rem]",
  label,
  byline,
}: {
  mark?: string;
  word?: string;
  /** Text to show instead of the wordmark, e.g. a screen title. Pass null for the mark alone. */
  label?: string | null;
  /** A small line under the wordmark, with its own classes for size and colour. */
  byline?: { text: string; className: string };
}) {
  const name = label === null ? null : (
    <span className={`font-display font-extrabold tracking-tight ${word}`}>
      {label ?? <Wordmark />}
    </span>
  );
  return (
    <span className="flex items-center gap-[0.625em]">
      <LogoMark className={mark} />
      {byline && name ? (
        <span className="flex flex-col">
          {name}
          <span className={byline.className}>{byline.text}</span>
        </span>
      ) : name}
    </span>
  );
}
