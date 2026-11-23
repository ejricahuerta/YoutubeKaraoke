import { OPERATOR } from "@/lib/domain/legal";

/** After a session ends: YouOke is free, and tips are welcome. */
export function TipNote() {
  return (
    <p className="mt-6 rounded-row bg-stage-200 px-5 py-4 text-base text-ink-muted">
      Enjoyed singing? YouOke is free. If you&apos;d like to say thanks, we accept tips by e-Transfer to{" "}
      <strong className="select-all font-semibold text-ink">{OPERATOR.tipEmail}</strong>.
    </p>
  );
}
