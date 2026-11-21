import { MicIcon } from "./icons";

/** The mic on an encore tile, optionally followed by the wordmark. Sizes come from the class props. */
export function Logo({
  tile = "h-8 w-8 rounded-[0.625rem]",
  icon = "h-5 w-5",
  word = "text-[1.375rem]",
  label = "Karaoke",
}: {
  tile?: string;
  icon?: string;
  word?: string;
  /** Pass null for the mark alone. */
  label?: string | null;
}) {
  return (
    <span className="flex items-center gap-[0.625em]">
      <span className={`grid shrink-0 place-items-center bg-encore text-on-encore ${tile}`}>
        <MicIcon className={icon} />
      </span>
      {label ? <span className={`font-display font-extrabold tracking-tight ${word}`}>{label}</span> : null}
    </span>
  );
}
