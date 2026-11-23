import type { RemoteStatus } from "@/lib/domain/types";
import { RemoteIcon } from "../Icons";

const LABELS: Record<RemoteStatus, string> = {
  unclaimed: "first phone to join",
  taken: "a phone",
  free: "free, any phone can take it",
};

/**
 * Who has the remote (migrations 0010, 0012), as a row of the main screen's Settings menu,
 * with a way to free it when the wrong phone has it. Then the first phone to ask takes it.
 * `itemProps` marks the button as one of the menu's controls, for moving with the arrows.
 */
export function RemoteIndicator({
  remote,
  name,
  onFree,
  itemProps,
}: {
  remote: RemoteStatus;
  name: string | null;
  onFree: () => void;
  itemProps: Record<string, string>;
}) {
  return (
    <div className="flex min-h-[4.5rem] w-full items-center gap-4 rounded-row px-[1.125rem] text-[1.5rem] font-semibold">
      <RemoteIcon className="h-[1.875rem] w-[1.875rem] shrink-0" />
      <span className="min-w-0 flex-1 truncate">Remote: {remote === "taken" && name ? name : LABELS[remote]}</span>
      {remote === "taken" ? (
        <button
          {...itemProps}
          type="button"
          onClick={onFree}
          className="h-12 shrink-0 rounded-full bg-stage-300 px-5 text-[1.25rem] font-semibold transition hover:bg-stage-100 active:scale-[0.97]"
        >
          Free the remote
        </button>
      ) : null}
    </div>
  );
}
