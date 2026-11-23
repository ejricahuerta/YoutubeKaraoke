import { OPERATOR } from "@/lib/domain/legal";

/** After a session ends: tips are welcome, and how to get in touch about a karaoke system. */
export function EndedNote() {
  return (
    <div className="mt-6 flex flex-col gap-3 rounded-row bg-stage-200 px-5 py-4 text-base text-ink-muted">
      <p>
        Enjoyed singing? YouOke is free. If you&apos;d like to say thanks, we accept tips by e-Transfer to{" "}
        <strong className="select-all font-semibold text-ink">{OPERATOR.tipEmail}</strong>.
      </p>
      <p>
        Want to work together on a karaoke system? Contact{" "}
        <a href={`mailto:${OPERATOR.email}`} className="font-semibold text-encore underline">{OPERATOR.email}</a>.
      </p>
    </div>
  );
}
