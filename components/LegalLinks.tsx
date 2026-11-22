import Link from "next/link";
import { LEGAL_PAGES } from "@/lib/domain/legal";

/** Terms · Privacy · Cookies. `newTab` keeps a guest's session open while they read. */
export function LegalLinks({ className = "", newTab = false }: { className?: string; newTab?: boolean }) {
  return (
    <nav aria-label="Legal" className={className}>
      <ul className="flex flex-wrap gap-x-5 gap-y-1">
        {LEGAL_PAGES.map((page) => (
          <li key={page.href}>
            <Link
              href={page.href}
              {...(newTab ? { target: "_blank", rel: "noopener" } : {})}
              className="underline-offset-2 hover:text-ink hover:underline"
            >
              {page.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** "By … you agree to the Terms of Use and Privacy Policy." Links open in a new tab. */
export function AgreementNotice({ action, className = "" }: { action: string; className?: string }) {
  const [terms, privacy] = LEGAL_PAGES;
  const link = "font-semibold text-ink-muted underline underline-offset-2 hover:text-ink";
  return (
    <p className={`text-xs text-ink-faint ${className}`}>
      By {action} you agree to the{" "}
      <Link href={terms.href} target="_blank" rel="noopener" className={link}>{terms.title}</Link> and{" "}
      <Link href={privacy.href} target="_blank" rel="noopener" className={link}>{privacy.title}</Link>.
    </p>
  );
}
