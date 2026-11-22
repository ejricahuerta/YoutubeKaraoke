import Link from "next/link";
import { CenteredMessage } from "../CenteredMessage";

/** Shown instead of a room when this browser is already in another one that is still going. */
export function OtherRoomMessage({ room, code, onSwitch }: { room: string; code: string; onSwitch: () => void }) {
  return (
    <CenteredMessage title={`You're in room ${room}`}>
      This browser is singing in room {room}. Every tab follows the same room and name.
      <span className="mt-6 flex flex-col gap-2">
        <Link
          href={`/join/${room}`}
          className="grid h-14 place-items-center rounded-full bg-encore text-lg font-bold text-on-encore transition hover:bg-encore-hover"
        >
          Back to room {room}
        </Link>
        <button
          type="button"
          onClick={onSwitch}
          className="h-12 rounded-full text-base font-semibold text-ink-muted transition hover:bg-stage-200 hover:text-ink"
        >
          Switch to room {code}
        </button>
      </span>
    </CenteredMessage>
  );
}
