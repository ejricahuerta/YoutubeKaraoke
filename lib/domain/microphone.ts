/**
 * The main screen's microphone (docs/adr/0024): its settings, and the sums behind the echo,
 * the reverb and the level meter. No browser here: lib/client/microphone-graph.ts builds the
 * audio from these numbers.
 */

export type MicSettings = {
  /** The singer's voice goes to the speakers. */
  isEnabled: boolean;
  /** Which input to use; null for the browser's default. */
  deviceId: string | null;
  /** 0-100. */
  micVolume: number;
  /** How loud the echo is, 0-100. */
  echoLevel: number;
  /** Time between echoes. */
  echoDelayMs: number;
  /** How long the echo keeps repeating, 0-100. */
  echoRepeats: number;
  /** How loud the reverb is, 0-100. */
  reverbLevel: number;
  /** 0 is a small room, 100 a big hall. */
  roomSize: number;
  hasNoiseSuppression: boolean;
  /** Takes the speakers' sound back out of the mic, so they do not feed back. */
  hasEchoCancellation: boolean;
  hasAutoGain: boolean;
  /** Skips the clean-up and asks for the smallest buffers: the shortest delay, but needs headphones. */
  isLowLatency: boolean;
};

export const ECHO_DELAY_MIN_MS = 60;
export const ECHO_DELAY_MAX_MS = 600;
/** Below 1, so every repeat is quieter than the one before and the echo dies away. */
export const ECHO_FEEDBACK_MAX = 0.7;
export const REVERB_DECAY_MIN_SECONDS = 0.4;
export const REVERB_DECAY_MAX_SECONDS = 4;
/** How sharply the reverb's tail fades: higher is a drier room. */
const REVERB_FADE_POWER = 3;
/** The mic volume slider goes up to twice the mic's own level, for quiet mics. */
export const MIC_GAIN_MAX = 2;
/** Anything quieter than this reads as nothing on the level meter. */
const METER_FLOOR_DB = -60;
/** Test mic turns itself off after this long, so a forgotten test does not stay live. */
export const MIC_TEST_TIMEOUT_MS = 30_000;
/** How quickly a slider change reaches the sound, without a click. */
export const MIC_RAMP_SECONDS = 0.03;
/** Cuts rumble and handling noise below this. */
export const MIC_HIGHPASS_HZ = 80;

const PERCENT_MAX = 100;

export const DEFAULT_MIC_SETTINGS: MicSettings = {
  isEnabled: false,
  deviceId: null,
  micVolume: 80,
  echoLevel: 30,
  echoDelayMs: 180,
  echoRepeats: 30,
  reverbLevel: 25,
  roomSize: 40,
  hasNoiseSuppression: true,
  hasEchoCancellation: true,
  hasAutoGain: false,
  isLowLatency: false,
};

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(Math.min(max, Math.max(min, value))) : fallback;
}

const percent = (value: unknown, fallback: number) => clampNumber(value, 0, PERCENT_MAX, fallback);
const flag = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);

/** The stored JSON as settings; anything missing or wrong takes its default. */
export function parseMicSettings(raw: string | null | undefined): MicSettings {
  let saved: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(raw ?? "null");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) saved = parsed;
  } catch {
    // bad data: the defaults
  }
  const d = DEFAULT_MIC_SETTINGS;
  return {
    isEnabled: flag(saved.isEnabled, d.isEnabled),
    deviceId: typeof saved.deviceId === "string" && saved.deviceId ? saved.deviceId : null,
    micVolume: percent(saved.micVolume, d.micVolume),
    echoLevel: percent(saved.echoLevel, d.echoLevel),
    echoDelayMs: clampNumber(saved.echoDelayMs, ECHO_DELAY_MIN_MS, ECHO_DELAY_MAX_MS, d.echoDelayMs),
    echoRepeats: percent(saved.echoRepeats, d.echoRepeats),
    reverbLevel: percent(saved.reverbLevel, d.reverbLevel),
    roomSize: percent(saved.roomSize, d.roomSize),
    hasNoiseSuppression: flag(saved.hasNoiseSuppression, d.hasNoiseSuppression),
    hasEchoCancellation: flag(saved.hasEchoCancellation, d.hasEchoCancellation),
    hasAutoGain: flag(saved.hasAutoGain, d.hasAutoGain),
    isLowLatency: flag(saved.isLowLatency, d.isLowLatency),
  };
}

export function serializeMicSettings(settings: MicSettings): string {
  return JSON.stringify(settings);
}

/** A 0-100 slider as a gain, on a curve that sounds even to the ear. */
export function percentToGain(value: number, max = 1): number {
  return max * (value / PERCENT_MAX) ** 2;
}

/** How much of each echo goes round again. */
export function echoFeedbackGain(repeats: number): number {
  return (repeats / PERCENT_MAX) * ECHO_FEEDBACK_MAX;
}

export function reverbDecaySeconds(roomSize: number): number {
  return REVERB_DECAY_MIN_SECONDS + ((REVERB_DECAY_MAX_SECONDS - REVERB_DECAY_MIN_SECONDS) * roomSize) / PERCENT_MAX;
}

/** One channel of a reverb's impulse response: noise that fades out over `seconds`. */
export function reverbImpulse(sampleRate: number, seconds: number, random: () => number = Math.random): Float32Array {
  const length = Math.max(1, Math.round(sampleRate * seconds));
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) samples[i] = (random() * 2 - 1) * (1 - i / length) ** REVERB_FADE_POWER;
  return samples;
}

/** How loud a block of samples (-1 to 1) is, as 0-1 for the level meter. */
export function meterLevel(samples: ArrayLike<number>): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  const rms = Math.sqrt(sum / samples.length);
  if (rms === 0) return 0;
  const db = 20 * Math.log10(rms);
  return Math.min(1, Math.max(0, (db - METER_FLOOR_DB) / -METER_FLOOR_DB));
}

export type MicConstraints = {
  deviceId?: { exact: string };
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  /** Seconds; 0 asks for the smallest buffer the browser allows. */
  latency?: number;
};

/**
 * What to ask the browser for. The clean-up switches apply when the mic is opened; low-latency
 * mode turns them all off, since each one holds the sound back a little to work on it.
 */
export function micConstraints(settings: MicSettings): MicConstraints {
  const { isLowLatency } = settings;
  return {
    ...(settings.deviceId ? { deviceId: { exact: settings.deviceId } } : {}),
    echoCancellation: !isLowLatency && settings.hasEchoCancellation,
    noiseSuppression: !isLowLatency && settings.hasNoiseSuppression,
    autoGainControl: !isLowLatency && settings.hasAutoGain,
    ...(isLowLatency ? { latency: 0 } : {}),
  };
}

/** Names Windows, macOS and Android give Bluetooth mics: "Hands-Free AG Audio", AirPods, Buds. */
const BLUETOOTH_NAME = /bluetooth|hands-?free|airpods|\bbuds\d*\b|\bbt\b/i;

/** Whether a mic's name says it is on Bluetooth, which adds delay no setting can take away. */
export function isBluetoothMic(label: string): boolean {
  return BLUETOOTH_NAME.test(label);
}

const MS_PER_SECOND = 1000;
/** Singers start to hear their own voice as late from about here. */
export const MIC_DELAY_NOTICEABLE_MS = 50;

/**
 * The delay the browser knows of, from the mic to the speakers, in ms; null when it reports
 * none. Bluetooth's own delay is not in it: the browser gets the sound after it.
 */
export function micDelayMs(parts: { inputSeconds?: number; baseSeconds?: number; outputSeconds?: number }): number | null {
  const known = [parts.inputSeconds, parts.baseSeconds, parts.outputSeconds].filter(
    (s): s is number => typeof s === "number" && Number.isFinite(s) && s >= 0,
  );
  return known.length ? Math.round(known.reduce((a, b) => a + b, 0) * MS_PER_SECOND) : null;
}

/** What to say under the delay; "" when it is short and the mic is not Bluetooth. */
export function micDelayHint(delayMs: number | null, isBluetooth: boolean): string {
  if (isBluetooth) {
    return "This is a Bluetooth mic, which adds about 100–300 ms more that the browser can’t measure. A wired, USB or wireless mic with its own receiver is much quicker.";
  }
  if (delayMs !== null && delayMs > MIC_DELAY_NOTICEABLE_MS) {
    return "Singers may hear this delay. Try Low latency, and wired or HDMI speakers instead of Bluetooth.";
  }
  return "";
}

export type MicStatus = "off" | "starting" | "live" | "needs-tap" | "denied" | "no-device" | "busy" | "unavailable";

/** A failed getUserMedia's error name, as a status. */
export function micStatusFromError(name: string): MicStatus {
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "denied";
    case "NotFoundError":
    case "OverconstrainedError":
      return "no-device";
    case "NotReadableError":
      return "busy";
    default:
      return "unavailable";
  }
}

/** What to tell the host about a status; "" when there is nothing to say. */
export function micStatusMessage(status: MicStatus): string {
  switch (status) {
    case "denied": return "The browser blocked the microphone. Allow it in the address bar, then try again.";
    case "no-device": return "No microphone found. Plug one in, or pick another below.";
    case "busy": return "Another app is using the microphone. Close it, then try again.";
    case "unavailable": return "This browser can’t use a microphone here.";
    case "needs-tap": return "Press anywhere to turn the microphone back on.";
    default: return "";
  }
}

/** The short state beside "Microphone" in the Settings menu. */
export function micMenuStatus(status: MicStatus): string {
  switch (status) {
    case "live": return "On";
    case "starting": return "Starting…";
    case "needs-tap": return "Paused";
    case "off": return "Off";
    default: return "Blocked";
  }
}

/** A mic's name; browsers leave labels empty until the mic is allowed. */
export function micDeviceLabel(device: { deviceId: string; label: string }, index: number): string {
  return device.label || `Microphone ${index + 1}`;
}
