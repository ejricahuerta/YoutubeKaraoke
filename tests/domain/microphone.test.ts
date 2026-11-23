import { describe, expect, it } from "vitest";
import {
  DEFAULT_MIC_SETTINGS,
  ECHO_DELAY_MAX_MS,
  ECHO_DELAY_MIN_MS,
  ECHO_FEEDBACK_MAX,
  echoFeedbackGain,
  clickDelaysMs,
  delayReadoutText,
  delaySummaryText,
  findOnsets,
  isBluetoothMic,
  micDelayHint,
  micDelayMs,
  meterLevel,
  micConstraints,
  micDeviceLabel,
  micMenuStatus,
  micStatusFromError,
  micStatusMessage,
  parseMicSettings,
  percentToGain,
  REVERB_DECAY_MAX_SECONDS,
  REVERB_DECAY_MIN_SECONDS,
  reverbDecaySeconds,
  reverbImpulse,
  serializeMicSettings,
  summarizeDelays,
} from "@/lib/domain/microphone";

describe("parseMicSettings", () => {
  it("starts with the mic off, and echo cancellation and noise suppression on", () => {
    expect(parseMicSettings(null)).toEqual(DEFAULT_MIC_SETTINGS);
    expect(DEFAULT_MIC_SETTINGS.isEnabled).toBe(false);
    expect(DEFAULT_MIC_SETTINGS.hasEchoCancellation).toBe(true);
    expect(DEFAULT_MIC_SETTINGS.hasNoiseSuppression).toBe(true);
  });

  it("reads back what was saved", () => {
    const saved = { ...DEFAULT_MIC_SETTINGS, isEnabled: true, deviceId: "usb-mic", echoLevel: 55, roomSize: 90, hasAutoGain: true };
    expect(parseMicSettings(serializeMicSettings(saved))).toEqual(saved);
  });

  it("falls back to the defaults for bad data", () => {
    expect(parseMicSettings("{not json")).toEqual(DEFAULT_MIC_SETTINGS);
    expect(parseMicSettings("42")).toEqual(DEFAULT_MIC_SETTINGS);
    expect(parseMicSettings(JSON.stringify({ isEnabled: "yes", deviceId: 7, micVolume: "loud" }))).toEqual(DEFAULT_MIC_SETTINGS);
  });

  it("keeps levels inside 0-100 and the echo delay inside its range", () => {
    const parsed = parseMicSettings(JSON.stringify({ micVolume: 250, echoLevel: -5, reverbLevel: 33.6, echoDelayMs: 5, echoRepeats: 1000 }));
    expect(parsed.micVolume).toBe(100);
    expect(parsed.echoLevel).toBe(0);
    expect(parsed.reverbLevel).toBe(34);
    expect(parsed.echoDelayMs).toBe(ECHO_DELAY_MIN_MS);
    expect(parsed.echoRepeats).toBe(100);
    expect(parseMicSettings(JSON.stringify({ echoDelayMs: 99_999 })).echoDelayMs).toBe(ECHO_DELAY_MAX_MS);
  });

  it("forgets an empty device id, so the browser's default mic is used", () => {
    expect(parseMicSettings(JSON.stringify({ deviceId: "" })).deviceId).toBeNull();
  });
});

describe("echoFeedbackGain", () => {
  it("never feeds back so much that the echo keeps growing", () => {
    expect(echoFeedbackGain(0)).toBe(0);
    expect(echoFeedbackGain(100)).toBe(ECHO_FEEDBACK_MAX);
    expect(ECHO_FEEDBACK_MAX).toBeLessThan(1);
    expect(echoFeedbackGain(50)).toBeCloseTo(ECHO_FEEDBACK_MAX / 2);
  });
});

describe("reverbDecaySeconds", () => {
  it("grows with the room size", () => {
    expect(reverbDecaySeconds(0)).toBe(REVERB_DECAY_MIN_SECONDS);
    expect(reverbDecaySeconds(100)).toBe(REVERB_DECAY_MAX_SECONDS);
    expect(reverbDecaySeconds(50)).toBeGreaterThan(REVERB_DECAY_MIN_SECONDS);
    expect(reverbDecaySeconds(50)).toBeLessThan(REVERB_DECAY_MAX_SECONDS);
  });
});

describe("percentToGain", () => {
  it("is silent at 0, full at 100, and gentle in between", () => {
    expect(percentToGain(0)).toBe(0);
    expect(percentToGain(100)).toBe(1);
    expect(percentToGain(50)).toBeLessThan(0.5);
    expect(percentToGain(100, 2)).toBe(2);
  });
});

describe("meterLevel", () => {
  it("is 0 for silence and for no samples", () => {
    expect(meterLevel(new Float32Array(128))).toBe(0);
    expect(meterLevel([])).toBe(0);
  });

  it("is 1 for a full-scale signal and in between for quieter ones", () => {
    expect(meterLevel(new Float32Array(128).fill(1))).toBe(1);
    const quiet = meterLevel(new Float32Array(128).fill(0.05));
    expect(quiet).toBeGreaterThan(0);
    expect(quiet).toBeLessThan(1);
    expect(meterLevel(new Float32Array(128).fill(0.2))).toBeGreaterThan(quiet);
  });
});

describe("reverbImpulse", () => {
  it("lasts the decay time and fades out", () => {
    const impulse = reverbImpulse(1000, 2, () => 1);
    expect(impulse).toHaveLength(2000);
    expect(Math.abs(impulse[0])).toBeGreaterThan(Math.abs(impulse[1000]));
    expect(Math.abs(impulse[1000])).toBeGreaterThan(Math.abs(impulse[1999]));
  });

  it("is noise, taken from the random source it is given", () => {
    const impulse = reverbImpulse(100, 1, () => 0);
    expect(impulse[0]).toBe(-1);
  });
});

describe("micConstraints", () => {
  it("asks for the chosen mic and the clean-up switches", () => {
    expect(micConstraints({ ...DEFAULT_MIC_SETTINGS, deviceId: "usb-mic", hasAutoGain: true })).toEqual({
      deviceId: { exact: "usb-mic" },
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    });
  });

  it("leaves the device to the browser when none was chosen", () => {
    expect(micConstraints(DEFAULT_MIC_SETTINGS)).not.toHaveProperty("deviceId");
  });

  it("in low-latency mode, skips the clean-up and asks for the shortest delay", () => {
    expect(micConstraints({ ...DEFAULT_MIC_SETTINGS, isLowLatency: true, hasAutoGain: true })).toEqual({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      latency: 0,
    });
    expect(micConstraints(DEFAULT_MIC_SETTINGS)).not.toHaveProperty("latency");
  });
});

describe("low-latency mode", () => {
  it("is off unless it was turned on", () => {
    expect(DEFAULT_MIC_SETTINGS.isLowLatency).toBe(false);
    expect(parseMicSettings(JSON.stringify({ isLowLatency: true })).isLowLatency).toBe(true);
    expect(parseMicSettings(JSON.stringify({ isLowLatency: "yes" })).isLowLatency).toBe(false);
  });
});

describe("isBluetoothMic", () => {
  it("spots Bluetooth headsets and earbuds by the names browsers give them", () => {
    expect(isBluetoothMic("Headset (WH-1000XM4 Hands-Free AG Audio)")).toBe(true);
    expect(isBluetoothMic("Default - Headset Microphone (Jabra Handsfree)")).toBe(true);
    expect(isBluetoothMic("AirPods Pro")).toBe(true);
    expect(isBluetoothMic("Galaxy Buds2 Pro")).toBe(true);
    expect(isBluetoothMic("JBL Bluetooth Speaker")).toBe(true);
  });

  it("leaves built-in, wired and USB mics alone", () => {
    expect(isBluetoothMic("Microphone Array (Realtek(R) Audio)")).toBe(false);
    expect(isBluetoothMic("Yeti Stereo Microphone")).toBe(false);
    expect(isBluetoothMic("USB PnP Sound Device")).toBe(false);
    expect(isBluetoothMic("Headset Microphone (Logitech USB Headset)")).toBe(false);
    expect(isBluetoothMic("")).toBe(false);
  });
});

describe("micDelayMs", () => {
  it("adds up the delays the browser reports, in whole milliseconds", () => {
    expect(micDelayMs({ inputSeconds: 0.01, baseSeconds: 0.0053, outputSeconds: 0.02 })).toBe(35);
  });

  it("counts only what is known, and says nothing when nothing is", () => {
    expect(micDelayMs({ baseSeconds: 0.01, outputSeconds: Number.NaN })).toBe(10);
    expect(micDelayMs({})).toBeNull();
  });
});

describe("micDelayHint", () => {
  it("says a short delay is fine and a long one is noticeable", () => {
    expect(micDelayHint(20, false)).toBe("");
    expect(micDelayHint(120, false)).not.toBe("");
  });

  it("warns that Bluetooth adds delay the browser cannot see", () => {
    expect(micDelayHint(20, true)).toMatch(/Bluetooth/);
    expect(micDelayHint(null, true)).toMatch(/Bluetooth/);
  });
});

describe("micStatusFromError", () => {
  it("tells a refused permission from a missing or busy mic", () => {
    expect(micStatusFromError("NotAllowedError")).toBe("denied");
    expect(micStatusFromError("SecurityError")).toBe("denied");
    expect(micStatusFromError("NotFoundError")).toBe("no-device");
    expect(micStatusFromError("OverconstrainedError")).toBe("no-device");
    expect(micStatusFromError("NotReadableError")).toBe("busy");
    expect(micStatusFromError("Whatever")).toBe("unavailable");
  });
});

describe("mic copy", () => {
  it("explains every problem in words", () => {
    for (const status of ["denied", "no-device", "busy", "unavailable", "needs-tap"] as const) {
      expect(micStatusMessage(status), status).not.toBe("");
    }
    expect(micStatusMessage("live")).toBe("");
  });

  it("sums the state up for the Settings menu", () => {
    expect(micMenuStatus("live")).toBe("On");
    expect(micMenuStatus("off")).toBe("Off");
    expect(micMenuStatus("denied")).toBe("Blocked");
    expect(micMenuStatus("needs-tap")).toBe("Paused");
  });

  it("names a mic the browser has not labelled yet", () => {
    expect(micDeviceLabel({ deviceId: "a", label: "USB Audio" }, 0)).toBe("USB Audio");
    expect(micDeviceLabel({ deviceId: "b", label: "" }, 1)).toBe("Microphone 2");
  });
});

describe("delayReadoutText", () => {
  it("says the browser's figure is a floor, not the whole delay", () => {
    expect(delayReadoutText(45, false)).toBe("Delay at least 45 ms");
    expect(delayReadoutText(45, true)).toBe("Delay at least 45 ms, plus Bluetooth");
  });
});

const RATE = 48_000;
const msToSamples = (ms: number) => Math.round((ms * RATE) / 1000);

/** A quiet recording with a short loud burst at each of `atMs`. */
function withClicks(lengthMs: number, atMs: number[], { level = 0.8, noise = 0.001 } = {}): Float32Array {
  const samples = new Float32Array(msToSamples(lengthMs));
  let seed = 1;
  for (let i = 0; i < samples.length; i++) {
    seed = (seed * 16807) % 2147483647;
    samples[i] = (seed / 2147483647 - 0.5) * 2 * noise;
  }
  for (const at of atMs) {
    const start = msToSamples(at);
    for (let i = 0; i < msToSamples(10); i++) samples[start + i] = level * Math.sin(i / 3);
  }
  return samples;
}

describe("findOnsets", () => {
  it("finds where each burst starts, once per burst", () => {
    const onsets = findOnsets(withClicks(3000, [500, 1500, 2500]), RATE);
    expect(onsets.map((i) => Math.round((i / RATE) * 1000))).toEqual([500, 1500, 2500]);
  });

  it("finds nothing in silence", () => {
    expect(findOnsets(withClicks(1000, []), RATE)).toEqual([]);
  });
});

describe("clickDelaysMs", () => {
  it("measures how long after each beep the mic heard it", () => {
    const reference = withClicks(4000, [500, 1500, 2500]);
    const heard = withClicks(4000, [620, 1630, 2610], { level: 0.05 });
    expect(clickDelaysMs(reference, heard, RATE)).toEqual([120, 130, 110]);
  });

  it("skips a beep the mic did not hear, rather than pairing it with the next one", () => {
    const reference = withClicks(4000, [500, 1500, 2500]);
    const heard = withClicks(4000, [620, 2610], { level: 0.05 });
    expect(clickDelaysMs(reference, heard, RATE)).toEqual([120, 110]);
  });
});

describe("summarizeDelays", () => {
  it("gives the median, the spread and the count", () => {
    expect(summarizeDelays([130, 110, 120, 190, 115])).toEqual({ count: 5, medianMs: 120, minMs: 110, maxMs: 190 });
    expect(summarizeDelays([100, 110])).toEqual({ count: 2, medianMs: 105, minMs: 100, maxMs: 110 });
  });

  it("is null with nothing measured", () => {
    expect(summarizeDelays([])).toBeNull();
  });
});

describe("delaySummaryText", () => {
  it("says the median and the spread, and what to make of it", () => {
    expect(delaySummaryText({ count: 6, medianMs: 42, minMs: 38, maxMs: 47 })).toBe("42 ms (38–47 ms, 6 beeps). Singers won’t notice.");
    expect(delaySummaryText({ count: 6, medianMs: 85, minMs: 80, maxMs: 95 })).toMatch(/^85 ms .*may notice/);
    expect(delaySummaryText({ count: 6, medianMs: 160, minMs: 140, maxMs: 210 })).toMatch(/Too late/);
  });

  it("says why nothing was measured", () => {
    expect(delaySummaryText(null)).toMatch(/didn’t hear the beeps/);
  });
});
