/** "Made by edmel.dev" credit line. `link={false}` renders plain text (for the main screen). */
export function Credit({ className = "", link = true }: { className?: string; link?: boolean }) {
  return (
    <p className={`text-xs text-ink-faint ${className}`}>
      Made by{" "}
      {link ? (
        <a
          href="https://edmel.dev"
          target="_blank"
          rel="noopener"
          className="font-semibold text-ink-muted underline-offset-2 hover:text-ink hover:underline"
        >
          edmel.dev
        </a>
      ) : (
        <span className="font-semibold text-ink-muted">edmel.dev</span>
      )}
    </p>
  );
}
