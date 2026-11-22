import Link from "next/link";
import { Credit } from "@/components/Credit";
import { LegalLinks } from "@/components/LegalLinks";
import { Logo } from "@/components/Logo";
import { LEGAL_UPDATED_ON } from "@/lib/domain/legal";

/** Shared frame for the terms, privacy policy and cookie policy: readable on a phone and a laptop. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[46rem] flex-col gap-10 px-4 py-8 sm:px-6">
      <header>
        <Link href="/" aria-label="YouOke home" className="inline-flex">
          <Logo mark="h-9 w-9" word="text-[1.5rem]" />
        </Link>
      </header>

      <main
        className={[
          "flex-1 text-base leading-relaxed text-ink-muted",
          "[&_h1]:font-display [&_h1]:text-[clamp(2.25rem,6vw,3.25rem)] [&_h1]:font-extrabold [&_h1]:leading-none [&_h1]:tracking-tight [&_h1]:text-ink",
          "[&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:tracking-tight [&_h2]:text-ink",
          "[&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-ink",
          "[&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6",
          "[&_strong]:font-semibold [&_strong]:text-ink",
          "[&_a]:font-semibold [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-encore",
        ].join(" ")}
      >
        {children}
        <p className="mt-12! text-sm text-ink-faint">Last updated {LEGAL_UPDATED_ON}.</p>
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-line pt-6 text-sm text-ink-faint">
        <LegalLinks />
        <Credit className="text-sm" />
      </footer>
    </div>
  );
}
