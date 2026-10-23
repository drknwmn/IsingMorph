import { GIFEncoder } from "gifenc";
import {
  IsingModel,
  validateConfig,
  schedule,
  fieldForFrame,
  enlarge,
  VERSION,
} from "./engine.js";

self.onmessage = ({ data }) => {
  try {
    const c = validateConfig(data.config),
      targets = data.targets;
    if (
      !Array.isArray(targets) ||
      targets.some(
        (t) =>
          !(t instanceof Float32Array) ||
          t.length !== c.size * c.size ||
          t.some((v) => !Number.isFinite(v) || v < -1 || v > 1),
      )
    )
      throw new Error("Invalid image fields.");
    const plan = schedule(c, targets.length),
      N = c.size * c.size;
    const model = new IsingModel(c.size, c.seed),
      field = new Float32Array(N),
      frames = new Uint8Array(plan.length * N),
      gif = GIFEncoder();
    const palette = [
        [0, 0, 0],
        [255, 255, 255],
      ],
      width = c.size * c.scale;
    let lastUpdate = 0;
    for (let k = 0; k < plan.length; k++) {
      const frame = plan[k],
        H = fieldForFrame(frame, targets, field);
      for (let s = 0; s < c.sweeps; s++) model.sweep(frame.T, H);
      const pixels = model.pixels();
      frames.set(pixels, k * N);
      // Cumulative rounding preserves the requested duration within one GIF tick.
      const delay =
        (Math.round(((k + 1) * 100) / c.fps) - Math.round((k * 100) / c.fps)) *
        10;
      gif.writeFrame(enlarge(pixels, c.size, c.scale), width, width, {
        palette: k === 0 ? palette : undefined,
        delay,
        repeat: c.loop ? 0 : -1,
      });
      const now = performance.now();
      if (k === plan.length - 1 || now - lastUpdate > 90) {
        const preview = pixels.slice();
        self.postMessage(
          {
            type: "progress",
            index: k + 1,
            total: plan.length,
            label: frame.label,
            pixels: preview,
          },
          [preview.buffer],
        );
        lastUpdate = now;
      }
    }
    gif.finish();
    const bytes = gif.bytes();
    self.postMessage(
      {
        type: "complete",
        frames,
        gif: bytes,
        labels: plan.map((p) => p.label),
        config: c,
        version: VERSION,
      },
      [frames.buffer, bytes.buffer],
    );
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error.message || "Generation failed.",
    });
  }
};
