import type { RemoteStatus } from "@/lib/domain/types";

const LABELS: Record<RemoteStatus, string> = {
  unclaimed: "first phone to join",
  taken: "a phone",
  free: "free, any phone can take it",
};

/**
 * Who has the remote (migrations 0010, 0012), on the main screen, with a way to free it
 * when the wrong phone has it. Then the first phone to ask takes it.
 */
export function RemoteIndicator({ remote, name, onFree }: { remote: RemoteStatus; name: string | null; onFree: () => void }) {
  return (
    <span className="flex h-14 shrink-0 items-center gap-1 rounded-full pl-6 pr-1.5 text-[1.375rem] font-semibold text-ink-muted">
      <span className="max-w-[16rem] truncate">Remote: {remote === "taken" && name ? name : LABELS[remote]}</span>
      {remote === "taken" ? (
        <button
          type="button"
          onClick={onFree}
          className="h-11 rounded-full px-4 text-[1.125rem] font-semibold text-ink transition hover:bg-stage-200 active:scale-[0.97]"
        >
          Free the remote
        </button>
      ) : null}
    </span>
  );
}
