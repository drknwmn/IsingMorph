export const VERSION = "1.1.0";
export const DEFAULTS = Object.freeze({
  size: 180,
  fps: 24,
  sweeps: 2,
  seed: 7,
  strength: 1.8,
  hot: 3.5,
  formation: 3.125,
  hold: 0.375,
  dissolve: 0.75,
  gap: 1.25,
  noise: 1.25,
  intro: 1.05,
  settle: 1.45,
  reheat: 0.95,
  mode: "dissolve",
  outro: true,
  scale: 2,
  loop: true,
});
export const PRESETS = Object.freeze({
  original: DEFAULTS,
  quick: Object.freeze({
    ...DEFAULTS,
    size: 128,
    fps: 20,
    sweeps: 3,
    formation: 2,
    hold: 0.75,
    gap: 0.75,
    noise: 0.6,
    intro: 0.5,
    settle: 0.75,
    reheat: 0.5,
  }),
});
export function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const ease = (t) => t * t * (3 - 2 * t);
export function validateConfig(input) {
  const c = { ...DEFAULTS, ...input };
  const ranges = {
    size: [64, 256],
    fps: [10, 30],
    sweeps: [1, 12],
    seed: [0, 4294967295],
    strength: [0.5, 4],
    hot: [2.5, 5],
    formation: [0.5, 5],
    hold: [0, 3],
    dissolve: [0.25, 3],
    gap: [0, 3],
    noise: [0, 2],
    intro: [0, 3],
    settle: [0, 3],
    reheat: [0.1, 2],
    scale: [1, 4],
  };
  for (const [key, [min, max]] of Object.entries(ranges)) {
    if (!Number.isFinite(c[key]) || c[key] < min || c[key] > max)
      throw new Error(`Invalid ${key}: expected ${min}–${max}.`);
  }
  for (const key of ["size", "fps", "sweeps", "seed", "scale"])
    if (!Number.isInteger(c[key]))
      throw new Error(`${key} must be an integer.`);
  if (
    ![64, 128, 180, 192, 256].includes(c.size) ||
    ![1, 2, 4].includes(c.scale) ||
    ![10, 15, 20, 24, 30].includes(c.fps)
  )
    throw new Error("Choose a supported grid size, GIF scale, and frame rate.");
  if (!["dissolve", "direct"].includes(c.mode))
    throw new Error("Choose a valid transition style.");
  if (typeof c.outro !== "boolean" || typeof c.loop !== "boolean")
    throw new Error("Invalid ending or loop setting.");
  return c;
}
export function schedule(config, count) {
  const c = validateConfig(config);
  if (!Number.isInteger(count) || count < 1 || count > 8)
    throw new Error("Choose between 1 and 8 images.");
  const result = [];
  const segment = (label, seconds, from, to, h0, h1, t0, t1) => {
    const n = Math.round(seconds * c.fps);
    for (let i = 0; i < n; i++) {
      const linear = (i + 1) / n;
      const t = ease(linear);
      result.push({
        label,
        from,
        to,
        mix: t,
        h: h0 + (h1 - h0) * t,
        T: t0 + (t1 - t0) * linear,
      });
    }
  };
  const tc = 2.269185314;
  segment("Disorder", c.noise, -1, -1, 0, 0, c.hot, c.hot);
  // Give clusters time to develop at the reference temperature before guiding them.
  segment("Critical fluctuations", c.intro, -1, -1, 0, 0, tc, tc);
  segment(
    "Forming image 1",
    c.formation,
    0,
    0,
    0,
    c.strength,
    tc * 1.08,
    tc * 0.98,
  );
  for (let i = 0; i < count; i++) {
    segment(
      `Holding image ${i + 1}`,
      c.hold,
      i,
      i,
      c.strength,
      c.strength,
      tc * 0.98,
      tc * 0.98,
    );
    if (i < count - 1) {
      if (c.mode === "direct") {
        segment(
          `Transforming ${i + 1} → ${i + 2}`,
          c.formation,
          i,
          i + 1,
          c.strength,
          c.strength,
          tc * 1.04,
          tc * 0.98,
        );
      } else {
        segment(
          `Dissolving image ${i + 1}`,
          c.dissolve,
          i,
          i,
          c.strength,
          0,
          tc * 0.98,
          tc * 1.02,
        );
        segment("Fluctuations", c.gap, -1, -1, 0, 0, tc, tc);
        segment(
          `Forming image ${i + 2}`,
          c.formation,
          i + 1,
          i + 1,
          0,
          c.strength,
          tc * 1.08,
          tc * 0.98,
        );
      }
    }
  }
  if (c.outro) {
    // The original loop releases its final image a little more slowly.
    segment(
      "Releasing the final image",
      c.dissolve * 1.25,
      count - 1,
      count - 1,
      c.strength,
      0,
      tc * 0.98,
      tc * 1.02,
    );
    segment("Final fluctuations", c.settle, -1, -1, 0, 0, tc, tc);
    segment("Returning to disorder", c.reheat, -1, -1, 0, 0, tc, c.hot);
    segment("Disorder", c.noise, -1, -1, 0, 0, c.hot, c.hot);
  }
  if (result.length * c.size * c.size > 64 * 1024 * 1024)
    throw new Error(
      "This sequence is too large. Reduce resolution, durations, or image count.",
    );
  if (result.length * c.size * c.size * c.scale * c.scale > 160 * 1024 * 1024)
    throw new Error(
      "This GIF is too large. Reduce GIF scale, resolution, or durations.",
    );
  return result;
}
export class IsingModel {
  constructor(size, seed = 7) {
    this.size = size;
    this.random = randomGenerator(seed);
    this.spins = new Int8Array(size * size);
    this.left = new Int32Array(size);
    this.right = new Int32Array(size);
    for (let i = 0; i < size; i++) {
      this.left[i] = (i + size - 1) % size;
      this.right[i] = (i + 1) % size;
    }
    for (let i = 0; i < this.spins.length; i++)
      this.spins[i] = this.random() < 0.5 ? -1 : 1;
  }
  delta(i, j, field = null) {
    const L = this.size,
      idx = i * L + j,
      S = this.spins;
    return (
      2 *
      S[idx] *
      (S[this.left[i] * L + j] +
        S[this.right[i] * L + j] +
        S[i * L + this.left[j]] +
        S[i * L + this.right[j]] +
        (field ? field[idx] : 0))
    );
  }
  sweep(T, field = null) {
    if (!Number.isFinite(T) || T <= 0)
      throw new Error("Temperature must be positive.");
    const L = this.size,
      N = L * L;
    for (let k = 0; k < N; k++) {
      const i = (this.random() * L) | 0,
        j = (this.random() * L) | 0,
        idx = i * L + j;
      const dE = this.delta(i, j, field);
      if (dE <= 0 || this.random() < Math.exp(-dE / T)) this.spins[idx] *= -1;
    }
  }
  pixels() {
    return Uint8Array.from(this.spins, (s) => (s === 1 ? 1 : 0));
  }
}
export function fieldForFrame(frame, targets, output) {
  if (frame.from < 0 || frame.h === 0) return null;
  const a = targets[frame.from],
    b = targets[frame.to];
  for (let i = 0; i < output.length; i++)
    output[i] = frame.h * (a[i] + (b[i] - a[i]) * frame.mix);
  return output;
}
export function enlarge(pixels, size, scale) {
  if (scale === 1) return pixels;
  const width = size * scale,
    out = new Uint8Array(width * width);
  for (let y = 0; y < width; y++)
    for (let x = 0; x < width; x++)
      out[y * width + x] = pixels[((y / scale) | 0) * size + ((x / scale) | 0)];
  return out;
}
