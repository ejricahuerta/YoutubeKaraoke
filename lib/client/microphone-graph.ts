/**
 * The main screen's microphone as Web Audio (docs/adr/0024). The YouTube player plays in a
 * cross-origin frame, so its sound cannot come in here: the voice gets its own AudioContext
 * and the two only meet at the speakers.
 *
 *   mic → rumble cut → mic volume ─┬─────────────────────────────→ out → speakers
 *                                  ├→ delay ⇄ repeats → echo level ─┘
 *                                  ├→ reverb → reverb level ────────┘
 *                                  └→ level meter
 */
import {
  ECHO_DELAY_MAX_MS,
  echoFeedbackGain,
  MIC_GAIN_MAX,
  MIC_HIGHPASS_HZ,
  MIC_RAMP_SECONDS,
  meterLevel,
  micConstraints,
  micDelayMs,
  percentToGain,
  reverbDecaySeconds,
  reverbImpulse,
  type MicSettings,
} from "@/lib/domain/microphone";

const MS_PER_SECOND = 1000;
const METER_FFT_SIZE = 1024;
const REVERB_CHANNELS = 2;

export type MicGraph = {
  /** Whether the browser is letting it play; "suspended" until someone presses something. */
  readonly state: () => AudioContextState;
  onStateChange: (listener: () => void) => void;
  resume: () => Promise<void>;
  /** Applies the sliders. The clean-up switches and the device need a new graph. */
  update: (settings: MicSettings) => void;
  /** The voice's level now, 0-1. */
  readLevel: () => number;
  /** The delay the browser reports from mic to speakers, in ms; null when it reports none. */
  readDelayMs: () => number | null;
  /** The name of the mic in use, as the browser gives it. */
  label: string;
  close: () => void;
};

/** Thrown when this browser has no getUserMedia or Web Audio, with the name micStatusFromError knows. */
function unsupported(): Error {
  const error = new Error("No microphone support");
  error.name = "NotSupportedError";
  return error;
}

/** Asks for the mic and wires it up. Rejects with getUserMedia's error when it cannot. */
export async function openMicGraph(settings: MicSettings): Promise<MicGraph> {
  if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === "undefined") throw unsupported();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: micConstraints(settings), video: false });

  // 0 asks for the smallest buffer the device allows; "interactive" is the browser's own safe low setting.
  const context = new AudioContext({ latencyHint: settings.isLowLatency ? 0 : "interactive" });
  const [track] = stream.getAudioTracks();
  const source = context.createMediaStreamSource(stream);
  const rumbleCut = context.createBiquadFilter();
  rumbleCut.type = "highpass";
  rumbleCut.frequency.value = MIC_HIGHPASS_HZ;
  const micGain = context.createGain();
  const out = context.createGain();
  const delay = context.createDelay(ECHO_DELAY_MAX_MS / MS_PER_SECOND);
  const repeats = context.createGain();
  const echoLevel = context.createGain();
  const reverb = context.createConvolver();
  const reverbLevel = context.createGain();
  const meter = context.createAnalyser();
  meter.fftSize = METER_FFT_SIZE;
  const meterSamples = new Float32Array(meter.fftSize);

  source.connect(rumbleCut).connect(micGain).connect(out).connect(context.destination);
  micGain.connect(delay).connect(echoLevel).connect(out);
  delay.connect(repeats).connect(delay);
  micGain.connect(reverb).connect(reverbLevel).connect(out);
  micGain.connect(meter);

  let roomSize: number | null = null;
  const ramp = (param: AudioParam, value: number) => param.setTargetAtTime(value, context.currentTime, MIC_RAMP_SECONDS);

  const update = (next: MicSettings) => {
    ramp(micGain.gain, percentToGain(next.micVolume, MIC_GAIN_MAX));
    ramp(echoLevel.gain, percentToGain(next.echoLevel));
    ramp(repeats.gain, echoFeedbackGain(next.echoRepeats));
    ramp(delay.delayTime, next.echoDelayMs / MS_PER_SECOND);
    ramp(reverbLevel.gain, percentToGain(next.reverbLevel));
    if (next.roomSize !== roomSize) {
      roomSize = next.roomSize;
      const seconds = reverbDecaySeconds(roomSize);
      const buffer = context.createBuffer(REVERB_CHANNELS, Math.round(context.sampleRate * seconds), context.sampleRate);
      for (let channel = 0; channel < REVERB_CHANNELS; channel++) buffer.copyToChannel(reverbImpulse(context.sampleRate, seconds) as Float32Array<ArrayBuffer>, channel);
      reverb.buffer = buffer;
    }
  };
  update(settings);
  // Created outside a press, the context starts suspended; one try costs nothing.
  if (context.state === "suspended") await context.resume().catch(() => {});

  return {
    state: () => context.state,
    onStateChange: (listener) => context.addEventListener("statechange", listener),
    resume: () => context.resume(),
    update,
    readLevel: () => {
      meter.getFloatTimeDomainData(meterSamples);
      return meterLevel(meterSamples);
    },
    readDelayMs: () =>
      micDelayMs({
        // Not in every browser's types or every browser: Chrome reports the capture side here.
        inputSeconds: (track?.getSettings() as { latency?: number } | undefined)?.latency,
        baseSeconds: context.baseLatency,
        outputSeconds: context.outputLatency,
      }),
    label: track?.label ?? "",
    close: () => {
      for (const track of stream.getTracks()) track.stop();
      context.close().catch(() => {});
    },
  };
}

export type MicDevice = { deviceId: string; label: string };

/** The audio inputs this browser can see. Labels are empty until the mic has been allowed. */
export async function listMicDevices(): Promise<MicDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "audioinput" && d.deviceId).map(({ deviceId, label }) => ({ deviceId, label }));
  } catch {
    return [];
  }
}
