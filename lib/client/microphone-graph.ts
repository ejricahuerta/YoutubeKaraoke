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
  CLICK_MAX_DELAY_MS,
  clickDelaysMs,
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
/** The delay measurement: a few short beeps, far enough apart that each one's echo has died. */
const MEASURE_BEEPS = 6;
const MEASURE_GAP_SECONDS = 0.8;
const MEASURE_LEAD_IN_SECONDS = 0.3;
const BEEP_SECONDS = 0.02;
const BEEP_HZ = 1500;
const BEEP_LEVEL = 0.9;
/** Big blocks are fine: the recording is only read once it is over. */
const RECORD_BLOCK = 4096;

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
  /**
   * Plays a few beeps through the speakers and times how late each comes back through the mic:
   * the whole mouth-to-speaker delay, including what the browser cannot see. The voice is muted
   * meanwhile. Resolves with one delay per beep heard, in ms.
   */
  measureDelay: () => Promise<number[]>;
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
  let latest = settings;
  const ramp = (param: AudioParam, value: number) => param.setTargetAtTime(value, context.currentTime, MIC_RAMP_SECONDS);

  const update = (next: MicSettings) => {
    latest = next;
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

  const measureDelay = async () => {
    ramp(micGain.gain, 0);
    // Side by side in one recording, so the two line up to the sample: the beep as it left for
    // the speakers, and the mic. A ScriptProcessor is enough for a one-off recording read at the end.
    const merger = context.createChannelMerger(2);
    const recorder = context.createScriptProcessor(RECORD_BLOCK, 2, 1);
    const silent = context.createGain();
    silent.gain.value = 0;
    const beeps = context.createGain();
    beeps.connect(context.destination);
    beeps.connect(merger, 0, 0);
    source.connect(merger, 0, 1);
    merger.connect(recorder).connect(silent).connect(context.destination);
    const sent: Float32Array[] = [];
    const heard: Float32Array[] = [];
    recorder.onaudioprocess = (e) => {
      sent.push(e.inputBuffer.getChannelData(0).slice());
      heard.push(e.inputBuffer.getChannelData(1).slice());
    };
    const start = context.currentTime + MEASURE_LEAD_IN_SECONDS;
    for (let i = 0; i < MEASURE_BEEPS; i++) {
      const beep = context.createOscillator();
      beep.frequency.value = BEEP_HZ;
      const level = context.createGain();
      level.gain.value = BEEP_LEVEL;
      beep.connect(level).connect(beeps);
      beep.start(start + i * MEASURE_GAP_SECONDS);
      beep.stop(start + i * MEASURE_GAP_SECONDS + BEEP_SECONDS);
    }
    const seconds = MEASURE_LEAD_IN_SECONDS + MEASURE_BEEPS * MEASURE_GAP_SECONDS + CLICK_MAX_DELAY_MS / MS_PER_SECOND;
    await new Promise((done) => setTimeout(done, seconds * MS_PER_SECOND));
    recorder.onaudioprocess = null;
    source.disconnect(merger);
    merger.disconnect();
    recorder.disconnect();
    beeps.disconnect();
    update(latest);
    return clickDelaysMs(join(sent), join(heard), context.sampleRate);
  };

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
    measureDelay,
    close: () => {
      for (const track of stream.getTracks()) track.stop();
      context.close().catch(() => {});
    },
  };
}

function join(blocks: Float32Array[]): Float32Array {
  const all = new Float32Array(blocks.reduce((n, b) => n + b.length, 0));
  let at = 0;
  for (const block of blocks) {
    all.set(block, at);
    at += block.length;
  }
  return all;
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
