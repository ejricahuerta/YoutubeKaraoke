/** "Made by edmel.dev" credit line. `link={false}` renders plain text (for the main screen). */
export function Credit({ className = "", link = true }: { className?: string; link?: boolean }) {
  return (
    <p className={`text-xs text-neutral-500 ${className}`}>
      Made by{" "}
      {link ? (
        <a
          href="https://edmel.dev"
          target="_blank"
          rel="noopener"
          className="font-medium text-neutral-400 underline-offset-2 hover:text-white hover:underline"
        >
          edmel.dev
        </a>
      ) : (
        <span className="font-medium text-neutral-400">edmel.dev</span>
      )}
    </p>
  );
}
