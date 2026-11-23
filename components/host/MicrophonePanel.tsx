"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { Microphone } from "@/lib/client/use-microphone";
import {
  delayReadoutText,
  delaySummaryText,
  ECHO_DELAY_MAX_MS,
  ECHO_DELAY_MIN_MS,
  isBluetoothMic,
  micDelayHint,
  summarizeDelays,
  micDeviceLabel,
  micStatusMessage,
  MIC_TEST_TIMEOUT_MS,
  type MicSettings,
} from "@/lib/domain/microphone";
import { MicIcon } from "../Icons";
import { OVERLINE } from "./styles";

/** Marks the controls that up and down move between, as in the Settings menu. */
const ITEM_ATTRIBUTE = "data-mic-item";
const FIRST_FOCUS_ATTRIBUTE = "data-mic-first-focus";
const MS_PER_SECOND = 1000;
const ECHO_DELAY_STEP_MS = 10;
const PERCENT = 100;
/** Problems that a second try can fix once the host has done something about them. */
const RETRYABLE = new Set(["denied", "no-device", "busy"]);
/** The browser's figures for the delay can change as the device settles, so they are read again this often. */
const DELAY_REFRESH_MS = 1000;

/**
 * The main screen's microphone settings (docs/adr/0024), opened from the Settings menu. A modal
 * dialog like ConfirmDialog: Escape or a press outside closes it, up and down move between its
 * controls for TV remotes. Closing it ends a mic test.
 */
export function MicrophonePanel({ mic, onClose }: { mic: Microphone; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { settings, change, status } = mic;

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement as HTMLElement | null;
    if (dialog && !dialog.open) dialog.showModal();
    // The on/off switch first, not Done: that is what a host opening this wants.
    dialog?.querySelector<HTMLElement>(`[${FIRST_FOCUS_ATTRIBUTE}]`)?.focus();
    return () => {
      dialog?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  function onKeyDown(e: KeyboardEvent) {
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!step || !dialogRef.current) return;
    e.preventDefault();
    const items = [...dialogRef.current.querySelectorAll<HTMLElement>(`[${ITEM_ATTRIBUTE}]:not(:disabled)`)];
    const index = items.indexOf(document.activeElement as HTMLElement);
    items[(index + step + items.length) % items.length]?.focus();
  }

  const item = { [ITEM_ATTRIBUTE]: "" };
  const isLive = status === "live";
  const message = micStatusMessage(status);
  const testSeconds = MIC_TEST_TIMEOUT_MS / MS_PER_SECOND;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      onCancel={(e) => {
        e.preventDefault(); // Escape: let the parent close it, so its state stays the truth
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // a press on the backdrop
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[76rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-panel border-0 bg-stage-100 p-0 text-ink shadow-lift backdrop:bg-stage-000/70"
    >
      <div className="flex flex-col gap-7 p-12">
        <div className="flex items-center gap-5">
          <MicIcon className="h-11 w-11 shrink-0" />
          <h2 id={titleId} className="font-display text-[2.75rem] font-bold leading-[1.05] tracking-tight">Microphone</h2>
          <button
            {...item}
            type="button"
            onClick={onClose}
            className="ml-auto h-[4.5rem] rounded-full bg-stage-300 px-9 text-[1.625rem] font-bold transition hover:bg-stage-200 active:scale-[0.97]"
          >
            Done
          </button>
        </div>

        <div className="grid gap-x-12 gap-y-7 lg:grid-cols-2">
          <section className="flex flex-col gap-5">
            <Switch
              item={{ ...item, [FIRST_FOCUS_ATTRIBUTE]: "" }}
              label="Use the microphone"
              hint="Your voice comes out of this screen’s speakers"
              checked={settings.isEnabled}
              onChange={(isEnabled) => change({ isEnabled })}
            />

            {message ? (
              <div role="status" className="flex items-center gap-4 rounded-row bg-notice-ground px-6 py-4 text-[1.5rem] font-semibold text-notice">
                <span className="flex-1">{message}</span>
                {RETRYABLE.has(status) ? (
                  <button {...item} type="button" onClick={mic.retry} className="shrink-0 rounded-full bg-stage-300 px-6 py-2 text-ink hover:bg-stage-200">
                    Try again
                  </button>
                ) : null}
              </div>
            ) : null}

            <label className="flex flex-col gap-2">
              <span className={`${OVERLINE} text-ink-muted`}>Input</span>
              <select
                {...item}
                value={settings.deviceId ?? ""}
                onChange={(e) => change({ deviceId: e.target.value || null })}
                className="h-[4.5rem] rounded-row bg-stage-200 px-5 text-[1.5rem] font-semibold"
              >
                <option value="">Default microphone</option>
                {mic.devices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>{micDeviceLabel(device, index)}</option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-3 rounded-card bg-stage-200 p-5">
              <LevelMeter isLive={isLive} readLevel={mic.readLevel} />
              {isLive ? <DelayReadout readDelayMs={mic.readDelayMs} isBluetooth={isBluetoothMic(mic.activeLabel)} /> : null}
              {isLive ? <MeasureDelay item={item} measure={mic.measureDelay} /> : null}
              {settings.isEnabled ? (
                <p className="text-[1.375rem] font-medium text-ink-muted">
                  {isLive ? "Live. Sing or speak to see the level." : status === "starting" ? "Starting the microphone…" : " "}
                </p>
              ) : (
                <div className="flex items-center gap-4">
                  <button
                    {...item}
                    type="button"
                    aria-pressed={mic.isTesting}
                    onClick={() => mic.setTesting(!mic.isTesting)}
                    className={`h-[4rem] shrink-0 rounded-full px-8 text-[1.5rem] font-bold transition active:scale-[0.97] ${
                      mic.isTesting ? "bg-ink text-stage-000" : "bg-encore text-on-encore hover:bg-encore-hover"
                    }`}
                  >
                    {mic.isTesting ? "Stop test" : "Test mic"}
                  </button>
                  <p className="text-[1.375rem] font-medium text-ink-muted">
                    {mic.isTesting ? "You should hear yourself, with the echo and reverb." : `Hear yourself for up to ${testSeconds} seconds.`}
                  </p>
                </div>
              )}
            </div>

            <h3 className={`${OVERLINE} mt-2 text-ink-muted`}>Delay and clean-up</h3>
            <Switch
              item={item}
              label="Low latency"
              hint="Shortest delay. Turns the clean-up off, so use headphones or keep the mic away from the speakers"
              checked={settings.isLowLatency}
              onChange={(isLowLatency) => change({ isLowLatency })}
            />
            {/* Low latency skips all three: each one holds the sound back to work on it. */}
            <Switch
              item={item}
              label="Echo cancellation"
              hint="Stops the speakers feeding back into the mic"
              checked={settings.hasEchoCancellation && !settings.isLowLatency}
              isDisabled={settings.isLowLatency}
              onChange={(hasEchoCancellation) => change({ hasEchoCancellation })}
            />
            <Switch
              item={item}
              label="Noise suppression"
              hint="Quietens hum and chatter around the mic"
              checked={settings.hasNoiseSuppression && !settings.isLowLatency}
              isDisabled={settings.isLowLatency}
              onChange={(hasNoiseSuppression) => change({ hasNoiseSuppression })}
            />
            <Switch
              item={item}
              label="Auto volume"
              hint="Evens out loud and quiet singers"
              checked={settings.hasAutoGain && !settings.isLowLatency}
              isDisabled={settings.isLowLatency}
              onChange={(hasAutoGain) => change({ hasAutoGain })}
            />
          </section>

          <section className="flex flex-col gap-5">
            <h3 className={`${OVERLINE} text-ink-muted`}>Sound</h3>
            <Slider item={item} label="Mic volume" settings={settings} field="micVolume" change={change} />
            <Slider item={item} label="Echo" settings={settings} field="echoLevel" change={change} />
            <Slider
              item={item}
              label="Echo delay"
              settings={settings}
              field="echoDelayMs"
              change={change}
              min={ECHO_DELAY_MIN_MS}
              max={ECHO_DELAY_MAX_MS}
              step={ECHO_DELAY_STEP_MS}
              unit=" ms"
            />
            <Slider item={item} label="Echo repeats" settings={settings} field="echoRepeats" change={change} />
            <Slider item={item} label="Reverb" settings={settings} field="reverbLevel" change={change} />
            <Slider item={item} label="Room size" settings={settings} field="roomSize" change={change} />
            <p className="rounded-row bg-stage-200 px-5 py-4 text-[1.375rem] font-medium leading-8 text-ink-muted">
              A squeal means the speakers are feeding back. Use a handheld mic or headphones, keep the mic away from the
              speakers, or turn the mic volume down.
            </p>
            <button
              {...item}
              type="button"
              onClick={mic.resetSound}
              className="h-[4rem] self-start rounded-full bg-stage-200 px-8 text-[1.5rem] font-bold transition hover:bg-stage-300 active:scale-[0.97]"
            >
              Reset sound
            </button>
          </section>
        </div>
      </div>
    </dialog>
  );
}

type ItemProps = Record<string, string>;

function Switch({
  item,
  label,
  hint,
  checked,
  isDisabled = false,
  onChange,
}: {
  item: ItemProps;
  label: string;
  hint: string;
  checked: boolean;
  isDisabled?: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      {...item}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={isDisabled}
      title={hint}
      onClick={() => onChange(!checked)}
      className="flex min-h-[4.5rem] w-full items-center gap-4 rounded-row px-[1.125rem] text-left transition hover:bg-stage-300 disabled:opacity-50 disabled:hover:bg-transparent"
    >
      <span className="flex flex-1 flex-col">
        <span className="text-[1.5rem] font-semibold">{label}</span>
        <span className="text-[1.25rem] font-medium text-ink-muted">{hint}</span>
      </span>
      <span aria-hidden="true" className={`relative h-8 w-14 shrink-0 rounded-full transition ${checked ? "bg-encore" : "bg-stage-000"}`}>
        <span className={`absolute top-1 h-6 w-6 rounded-full transition-all ${checked ? "left-7 bg-stage-000" : "left-1 bg-ink-muted"}`} />
      </span>
    </button>
  );
}

type NumberField = { [K in keyof MicSettings]: MicSettings[K] extends number ? K : never }[keyof MicSettings];

function Slider({
  item,
  label,
  settings,
  field,
  change,
  min = 0,
  max = PERCENT,
  step = 1,
  unit = "",
}: {
  item: ItemProps;
  label: string;
  settings: MicSettings;
  field: NumberField;
  change: (patch: Partial<MicSettings>) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  const value = settings[field];
  return (
    <label className="flex flex-col gap-2 px-[1.125rem]">
      <span className="flex items-baseline justify-between text-[1.5rem] font-semibold">
        {label}
        <span className="text-[1.375rem] font-medium tabular-nums text-ink-muted">{value}{unit}</span>
      </span>
      <input
        {...item}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        aria-valuetext={`${value}${unit}`}
        onChange={(e) => change({ [field]: Number(e.target.value) } as Partial<MicSettings>)}
        className="h-2.5 w-full cursor-pointer accent-ink"
      />
    </label>
  );
}

/** How late the voice comes out, as far as the browser knows, and what to do when that is too late. */
function DelayReadout({ readDelayMs, isBluetooth }: { readDelayMs: () => number | null; isBluetooth: boolean }) {
  const [delayMs, setDelayMs] = useState<number | null>(null);
  useEffect(() => {
    const read = () => setDelayMs(readDelayMs());
    const first = setTimeout(read, 0);
    const timer = setInterval(read, DELAY_REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [readDelayMs]);
  const hint = micDelayHint(delayMs, isBluetooth);
  return (
    <>
      {delayMs !== null ? (
        <p className="text-[1.375rem] font-semibold tabular-nums">{delayReadoutText(delayMs, isBluetooth)}</p>
      ) : null}
      {hint ? (
        <p role="status" className="rounded-row bg-notice-ground px-5 py-3 text-[1.375rem] font-semibold leading-8 text-notice">{hint}</p>
      ) : null}
    </>
  );
}

/** Times the whole mouth-to-speaker delay with beeps, since the browser's own figure leaves part of it out. */
function MeasureDelay({ item, measure }: { item: ItemProps; measure: () => Promise<number[]> }) {
  const [result, setResult] = useState<string | null>(null);
  const [isMeasuring, setMeasuring] = useState(false);
  const run = async () => {
    setMeasuring(true);
    setResult(null);
    const delays = await measure();
    setMeasuring(false);
    setResult(delaySummaryText(summarizeDelays(delays)));
  };
  return (
    <div className="flex items-center gap-4">
      <button
        {...item}
        type="button"
        disabled={isMeasuring}
        onClick={() => void run()}
        className="h-[4rem] shrink-0 rounded-full bg-stage-300 px-8 text-[1.5rem] font-bold transition hover:bg-stage-100 disabled:opacity-60"
      >
        {isMeasuring ? "Measuring…" : "Measure delay"}
      </button>
      <p role="status" className="text-[1.375rem] font-medium tabular-nums text-ink-muted">
        {result ?? "Beeps through the speakers and times how late the mic hears them."}
      </p>
    </div>
  );
}

/** A bar that follows the voice. Drawn straight to the page each frame, without re-rendering. */
function LevelMeter({ isLive, readLevel }: { isLive: boolean; readLevel: () => number }): ReactNode {
  const barRef = useRef<HTMLDivElement>(null);
  const meterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = barRef.current;
    const meter = meterRef.current;
    if (!bar || !meter) return;
    const draw = (level: number) => {
      const percent = Math.round(level * PERCENT);
      bar.style.width = `${percent}%`;
      meter.setAttribute("aria-valuenow", String(percent));
    };
    if (!isLive) return draw(0);
    let frame = requestAnimationFrame(function tick() {
      draw(readLevel());
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [isLive, readLevel]);

  return (
    <div
      ref={meterRef}
      role="meter"
      aria-label="Microphone level"
      aria-valuemin={0}
      aria-valuemax={PERCENT}
      aria-valuenow={0}
      className="h-5 w-full overflow-hidden rounded-full bg-stage-000"
    >
      <div ref={barRef} className="h-full w-0 rounded-full bg-spotlight" />
    </div>
  );
}
