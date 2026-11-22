/**
 * The main screen's "Take turns" setting (migration 0011): once 3 or more people have songs
 * on the list, each sings once per round. On by default; switching it on again puts the
 * waiting list in turns.
 */
export function TakeTurnsSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      title="With 3 or more people, everyone sings once before anyone sings again"
      className="flex h-14 shrink-0 items-center gap-3 rounded-full px-6 text-[1.375rem] font-semibold text-ink-muted transition hover:bg-stage-200 hover:text-ink active:scale-[0.97]"
    >
      Take turns
      <span aria-hidden="true" className={`relative h-8 w-14 rounded-full transition ${on ? "bg-encore" : "bg-stage-300"}`}>
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-stage-000 transition-all ${on ? "left-7" : "left-1"}`} />
      </span>
    </button>
  );
}
