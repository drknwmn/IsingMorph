import test from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import gifenc from "gifenc";
const { GIFEncoder } = gifenc;
import {
  DEFAULTS,
  randomGenerator,
  IsingModel,
  validateConfig,
  schedule,
  fieldForFrame,
  enlarge,
} from "../src/engine.js";

test("a seed reproduces the actual trajectory, not just initialization", () => {
  const a = new IsingModel(16, 42),
    b = new IsingModel(16, 42),
    other = new IsingModel(16, 43);
  assert.notDeepEqual(a.spins, other.spins);
  for (let i = 0; i < 30; i++) {
    a.sweep(2.269);
    b.sweep(2.269);
  }
  assert.deepEqual(a.spins, b.spins);
  assert.ok(a.spins.every((s) => s === -1 || s === 1));
  assert.notEqual(randomGenerator(0)(), randomGenerator(1)());
});
test("local flip energies match the independent total-energy calculation including wrapped edges", () => {
  const m = new IsingModel(7, 7),
    H = Float32Array.from({ length: 49 }, (_, i) => ((i % 5) - 2) * 0.3);
  function energy() {
    let E = 0;
    for (let i = 0; i < 7; i++)
      for (let j = 0; j < 7; j++) {
        const s = m.spins[i * 7 + j];
        E -=
          s *
          (m.spins[((i + 1) % 7) * 7 + j] +
            m.spins[i * 7 + ((j + 1) % 7)] +
            H[i * 7 + j]);
      }
    return E;
  }
  for (const [i, j] of [
    [0, 0],
    [0, 6],
    [6, 0],
    [6, 6],
    [3, 3],
  ]) {
    const before = energy(),
      expected = m.delta(i, j, H);
    m.spins[i * 7 + j] *= -1;
    assert.ok(Math.abs(energy() - before - expected) < 1e-6);
    m.spins[i * 7 + j] *= -1;
  }
});
test("strong image fields guide spins with both polarities", () => {
  const m = new IsingModel(16, 4),
    H = Float32Array.from({ length: 256 }, (_, i) => (i % 16 < 8 ? 100 : -100));
  for (let i = 0; i < 20; i++) m.sweep(1, H);
  assert.ok(m.spins.every((s, i) => s === (i % 16 < 8 ? 1 : -1)));
});
test("dissolve and direct modes have distinct schedules with all image holds", () => {
  const dissolve = schedule(DEFAULTS, 3),
    direct = schedule({ ...DEFAULTS, mode: "direct" }, 3);
  assert.ok(dissolve.some((p) => p.label === "Fluctuations" && p.from === -1));
  assert.ok(!direct.some((p) => p.label === "Fluctuations"));
  assert.ok(
    direct.some((p) => p.from === 0 && p.to === 1 && p.mix > 0 && p.mix < 1),
  );
  for (let i = 1; i <= 3; i++)
    assert.equal(
      dissolve.filter((p) => p.label === `Holding image ${i}`).length,
      15,
    );
  assert.ok(
    !schedule({ ...DEFAULTS, outro: false }, 1).some(
      (p) => p.label === "Returning to disorder",
    ),
  );
  assert.ok(dissolve.every((p) => Number.isFinite(p.T) && p.T > 0 && p.h >= 0));
});
test("field interpolation is the actual blend, and zero guidance is field-free", () => {
  const a = new Float32Array([-1, 1]),
    b = new Float32Array([1, -1]),
    out = new Float32Array(2);
  assert.deepEqual(
    fieldForFrame({ from: 0, to: 1, h: 2, mix: 0.25 }, [a, b], out),
    new Float32Array([-1, 1]),
  );
  assert.equal(
    fieldForFrame({ from: 0, to: 1, h: 0, mix: 0.5 }, [a, b], out),
    null,
  );
});
test("invalid and excessive requests are rejected before allocations", () => {
  for (const patch of [
    { size: Infinity },
    { size: 128.5 },
    { seed: -1 },
    { sweeps: 0 },
    { fps: NaN },
    { mode: "unknown" },
    { loop: "yes" },
  ])
    assert.throws(() => validateConfig(patch));
  assert.throws(() => schedule(DEFAULTS, 0));
  assert.throws(() => schedule(DEFAULTS, 9));
  assert.throws(
    () =>
      schedule(
        {
          ...DEFAULTS,
          size: 256,
          scale: 4,
          formation: 5,
          hold: 3,
          gap: 3,
          dissolve: 3,
        },
        8,
      ),
    /too large/,
  );
  assert.throws(() => new IsingModel(8).sweep(0));
});
test("scaling enlarges pixels without interpolation", () => {
  assert.deepEqual(
    enlarge(new Uint8Array([0, 1, 1, 0]), 2, 2),
    new Uint8Array([0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0]),
  );
});
test("the bundled encoder writes a two-color GIF with the expected header and trailer", () => {
  const gif = GIFEncoder();
  for (let i = 0; i < 3; i++)
    gif.writeFrame(new Uint8Array([i % 2, 1, i % 2, 0]), 2, 2, {
      palette:
        i === 0
          ? [
              [0, 0, 0],
              [255, 255, 255],
            ]
          : undefined,
      delay: 50,
      repeat: 0,
    });
  gif.finish();
  const bytes = gif.bytes();
  assert.equal(new TextDecoder().decode(bytes.subarray(0, 6)), "GIF89a");
  assert.equal(bytes[bytes.length - 1], 0x3b);
  if (process.env.GIF_TEST_OUTPUT)
    writeFileSync(process.env.GIF_TEST_OUTPUT, bytes);
});
