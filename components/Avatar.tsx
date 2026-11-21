import { singerColorIndex, singerInitial } from "@/lib/domain/singers";

/** One class per colour slot, spelled out so Tailwind keeps them (SINGER_COLOR_COUNT entries). */
const FILLS = [
  "bg-singer-1", "bg-singer-2", "bg-singer-3", "bg-singer-4",
  "bg-singer-5", "bg-singer-6", "bg-singer-7", "bg-singer-8",
];

/** A singer's coloured disc and initial. Size and text size come from `className`. */
export function Avatar({ name, className = "h-10 w-10 text-base" }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-bold leading-none text-on-singer ${FILLS[singerColorIndex(name)]} ${className}`}
    >
      {singerInitial(name)}
    </span>
  );
}
