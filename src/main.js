import {
  DEFAULTS,
  PRESETS,
  VERSION,
  validateConfig,
  schedule,
} from "./engine.js";

const $ = (id) => document.getElementById(id);
const state = {
  images: [],
  config: { ...DEFAULTS },
  result: null,
  worker: null,
  busy: false,
  playing: false,
  frame: 0,
  raf: 0,
  gifUrl: null,
  dirty: false,
  fit: "contain",
  background: "black",
  threshold: 0.5,
};
const canvas = $("canvas"),
  ctx = canvas.getContext("2d", { alpha: false });
const durationKeys = new Set([
  "formation",
  "hold",
  "dissolve",
  "gap",
  "noise",
  "intro",
  "settle",
  "reheat",
]);
const clock = (t) =>
  `${Math.floor(t / 60)}:${Math.floor(t % 60)
    .toString()
    .padStart(2, "0")}`;
const uid = () => crypto.randomUUID();
const message = (text) => {
  $("message").textContent = text;
};
const node = (tag, className, text) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
};
function normalized(image, size = state.config.size) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.fillStyle = state.background;
  x.fillRect(0, 0, size, size);
  const w = image.source.naturalWidth,
    h = image.source.naturalHeight;
  const ratio =
    state.fit === "contain"
      ? Math.min(size / w, size / h)
      : Math.max(size / w, size / h);
  x.drawImage(
    image.source,
    (size - w * ratio) / 2,
    (size - h * ratio) / 2,
    w * ratio,
    h * ratio,
  );
  const d = x.getImageData(0, 0, size, size).data,
    field = new Float32Array(size * size);
  for (let i = 0; i < field.length; i++) {
    let v =
      (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
    if (image.invert) v = 1 - v;
    if (image.binary) v = v > state.threshold ? 1 : 0;
    field[i] = v * 2 - 1;
  }
  return field;
}
function fieldPreview(field, size) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d");
  const pixels = x.createImageData(size, size);
  for (let i = 0; i < field.length; i++) {
    const v = Math.round((field[i] + 1) * 127.5);
    pixels.data.set([v, v, v, 255], i * 4);
  }
  x.putImageData(pixels, 0, 0);
  return c.toDataURL("image/png");
}
function draw(pixels, size) {
  if (canvas.width !== size) canvas.width = canvas.height = size;
  const data = ctx.createImageData(size, size);
  for (let i = 0; i < pixels.length; i++) {
    const v = pixels[i] * 255;
    data.data.set([v, v, v, 255], i * 4);
  }
  ctx.putImageData(data, 0, 0);
}
function idlePreview() {
  if (state.result || state.busy) return;
  const L = state.config.size;
  const f = state.images[0] ? normalized(state.images[0]) : null;
  draw(
    Uint8Array.from({ length: L * L }, (_, i) => (f && f[i] > 0 ? 1 : 0)),
    L,
  );
  $("dimensions").textContent = `${L}² lattice`;
  $("frame-label").textContent = state.images.length
    ? "Your first image, waiting to emerge."
    : "Add an image to begin.";
}
function markDirty() {
  state.dirty = Boolean(state.result);
  $("stale-note").hidden = !state.dirty;
  if (state.result) $("preview-state").textContent = "Previous generation";
  updateEstimate();
  idlePreview();
}
function updateEstimate() {
  try {
    const plan = schedule(state.config, state.images.length || 1),
      width = state.config.size * state.config.scale;
    $("estimate").textContent =
      `${(plan.length / state.config.fps).toFixed(1)} s · ${plan.length} frames · ${width} × ${width} GIF`;
    $("generate").disabled = state.busy || !state.images.length;
  } catch (e) {
    $("estimate").textContent = e.message;
    $("generate").disabled = true;
  }
}
function imageRow(image, index) {
  const row = node("div", "image-row"),
    img = node("img");
  img.src = fieldPreview(normalized(image, 64), 64);
  img.alt = `Processed preview: ${image.name}`;
  const info = node("div", "image-info"),
    name = node("span", "image-name", `${index + 1}. ${image.name}`);
  name.title = image.name;
  const options = node("div", "image-options");
  for (const [key, label] of [
    ["invert", "Invert"],
    ["binary", "Binary mask"],
  ]) {
    const wrap = node("label"),
      input = node("input");
    input.type = "checkbox";
    input.checked = image[key];
    input.disabled = state.busy;
    input.setAttribute("aria-label", `${label} for ${image.name}`);
    input.addEventListener("change", () => {
      image[key] = input.checked;
      renderImages();
      markDirty();
    });
    wrap.append(input, document.createTextNode(label));
    options.append(wrap);
  }
  info.append(name, options);
  const actions = node("div", "image-row-actions");
  for (const [text, label, disabled, action] of [
    [
      "↑",
      "Move earlier",
      index === 0,
      () => {
        [state.images[index - 1], state.images[index]] = [
          state.images[index],
          state.images[index - 1],
        ];
      },
    ],
    [
      "↓",
      "Move later",
      index === state.images.length - 1,
      () => {
        [state.images[index + 1], state.images[index]] = [
          state.images[index],
          state.images[index + 1],
        ];
      },
    ],
    [
      "×",
      "Remove",
      false,
      () => {
        URL.revokeObjectURL(image.url);
        state.images.splice(index, 1);
      },
    ],
  ]) {
    const b = node("button", "icon-button", text);
    b.type = "button";
    b.disabled = disabled || state.busy;
    b.setAttribute("aria-label", `${label}: ${image.name}`);
    b.addEventListener("click", () => {
      action();
      renderImages();
      markDirty();
    });
    actions.append(b);
  }
  row.append(img, info, actions);
  return row;
}
function renderImages() {
  $("sequence").replaceChildren(...state.images.map(imageRow));
  $("image-count").textContent = `${state.images.length} / 8`;
  $("clear-images").disabled = state.busy || state.images.length === 0;
  updateEstimate();
  idlePreview();
}
async function readImage(blob, name) {
  if (blob.size > 12 * 1024 * 1024)
    throw new Error(`${name}: please choose a file smaller than 12 MB.`);
  if (!["image/png", "image/jpeg", "image/webp"].includes(blob.type))
    throw new Error(`${name}: choose PNG, JPG, or WebP.`);
  const url = URL.createObjectURL(blob),
    source = new Image();
  source.src = url;
  try {
    await source.decode();
    if (
      !source.naturalWidth ||
      source.naturalWidth * source.naturalHeight > 24 * 1024 * 1024
    )
      throw new Error("Choose an image under 24 megapixels.");
    const image = {
      id: uid(),
      name,
      blob,
      source,
      url,
      invert: false,
      binary: false,
    };
    const f = normalized(image, 32);
    let total = 0,
      count = 0;
    for (let i = 0; i < 32; i++) {
      total += f[i] + f[31 * 32 + i] + f[i * 32] + f[i * 32 + 31];
      count += 4;
    }
    image.invert = total / count > 0;
    return image;
  } catch (error) {
    URL.revokeObjectURL(url);
    throw new Error(`${name}: ${error.message || "could not decode image."}`);
  }
}
async function addFiles(files) {
  if (state.busy) return;
  const list = Array.from(files);
  message("");
  if (state.images.length + list.length > 8) {
    message("Use up to 8 images in one sequence.");
    return;
  }
  const loaded = [];
  try {
    for (const f of list) loaded.push(await readImage(f, f.name));
    if (state.busy) {
      loaded.forEach((i) => URL.revokeObjectURL(i.url));
      return;
    }
    if (state.images.length + loaded.length > 8)
      throw new Error("Use up to 8 images in one sequence.");
    state.images.push(...loaded);
    renderImages();
    markDirty();
  } catch (e) {
    loaded.forEach((i) => URL.revokeObjectURL(i.url));
    message(e.message);
  }
}
async function exampleBlob(shape) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d");
  x.fillStyle = "black";
  x.fillRect(0, 0, 256, 256);
  x.fillStyle = "white";
  if (shape === "Circle") {
    x.beginPath();
    x.arc(128, 128, 78, 0, 2 * Math.PI);
    x.fill();
  }
  if (shape === "Star") {
    x.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5,
        r = i % 2 ? 38 : 89;
      x.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r);
    }
    x.closePath();
    x.fill();
  }
  if (shape === "Heart") {
    x.beginPath();
    x.moveTo(128, 211);
    x.bezierCurveTo(103, 184, 34, 139, 42, 91);
    x.bezierCurveTo(50, 43, 105, 39, 128, 84);
    x.bezierCurveTo(151, 39, 206, 43, 214, 91);
    x.bezierCurveTo(222, 139, 153, 184, 128, 211);
    x.fill();
  }
  return new Promise((resolve) => c.toBlob(resolve, "image/png"));
}
async function loadExamples() {
  if (state.busy) return;
  message("");
  const loaded = [];
  try {
    for (const shape of ["Circle", "Star", "Heart"])
      loaded.push(await readImage(await exampleBlob(shape), shape));
    if (state.busy) {
      loaded.forEach((i) => URL.revokeObjectURL(i.url));
      return;
    }
    state.images.forEach((i) => URL.revokeObjectURL(i.url));
    state.images = loaded;
    renderImages();
    markDirty();
  } catch (e) {
    loaded.forEach((i) => URL.revokeObjectURL(i.url));
    message(e.message);
  }
}
function syncControls() {
  for (const key of Object.keys(DEFAULTS)) {
    const el = $(key);
    if (!el) continue;
    if (key === "outro") el.checked = state.config[key];
    else if (key === "loop") el.value = state.config.loop ? "yes" : "no";
    else el.value = state.config[key];
  }
  document.querySelectorAll('input[name="mode"]').forEach((el) => {
    el.checked = el.value === state.config.mode;
  });
  for (const el of document.querySelectorAll("[data-config]")) {
    const key = el.dataset.config;
    $(key + "-value").textContent =
      `${Number(state.config[key].toFixed(3))}${durationKeys.has(key) ? " s" : ""}`;
  }
  const motionKeys = Object.keys(DEFAULTS).filter(
    (key) => !["seed", "scale", "loop"].includes(key),
  );
  $("motion-preset").value =
    Object.entries(PRESETS).find(([, preset]) =>
      motionKeys.every((key) => preset[key] === state.config[key]),
    )?.[0] || "custom";
  $("fit").value = state.fit;
  $("background").value = state.background;
  $("threshold").value = state.threshold;
  $("threshold-value").textContent = state.threshold;
  document.querySelectorAll(".dissolve-setting").forEach((el) => {
    el.hidden = state.config.mode === "direct";
  });
  $("mode-description").textContent =
    state.config.mode === "direct"
      ? "Shift the guiding field directly from one image to the next."
      : "Release each image into fluctuations before the next one forms.";
  updateEstimate();
}
function busy(value) {
  state.busy = value;
  document.body.classList.toggle("is-busy", value);
  document
    .querySelectorAll(".controls input,.controls select,.controls button")
    .forEach((el) => {
      el.disabled = value;
    });
  $("cancel").hidden = !value;
  $("cancel").disabled = false;
  $("generate").hidden = value;
  $("generation-status").hidden = !value;
  $("load-settings").disabled = value;
  $("play").disabled = value || !state.result;
  $("scrub").disabled = value || !state.result;
  $("download-png").disabled = value || !state.result;
  if (!value) renderImages();
}
function stopPlayback() {
  state.playing = false;
  cancelAnimationFrame(state.raf);
  $("play").textContent = "▶";
  $("play").setAttribute("aria-label", "Play animation");
}
function showFrame(index) {
  const r = state.result;
  if (!r) return;
  state.frame = Math.max(0, Math.min(r.labels.length - 1, index));
  const N = r.config.size * r.config.size;
  draw(
    r.frames.subarray(state.frame * N, (state.frame + 1) * N),
    r.config.size,
  );
  $("scrub").value = state.frame;
  $("frame-label").textContent = r.labels[state.frame];
  $("timecode").textContent =
    `${clock(state.frame / r.config.fps)} / ${clock(r.labels.length / r.config.fps)}`;
}
function play() {
  if (!state.result || state.busy) return;
  if (state.playing) {
    stopPlayback();
    return;
  }
  const r = state.result;
  if (state.frame === r.labels.length - 1) showFrame(0);
  state.playing = true;
  $("play").textContent = "Ⅱ";
  $("play").setAttribute("aria-label", "Pause animation");
  const initial = state.frame,
    start = performance.now();
  const tick = (now) => {
    if (!state.playing) return;
    let index = initial + Math.floor(((now - start) * r.config.fps) / 1000);
    if (index >= r.labels.length) {
      if (!r.config.loop) {
        showFrame(r.labels.length - 1);
        stopPlayback();
        return;
      }
      index %= r.labels.length;
    }
    if (index !== state.frame) showFrame(index);
    state.raf = requestAnimationFrame(tick);
  };
  state.raf = requestAnimationFrame(tick);
}
function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = node("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function generate() {
  if (state.busy) return;
  message("");
  stopPlayback();
  try {
    const config = validateConfig(state.config);
    schedule(config, state.images.length);
    const targets = state.images.map((i) => normalized(i));
    const imageSettings = state.images.map((i) => ({
      name: i.name,
      invert: i.invert,
      binary: i.binary,
    }));
    const treatment = {
      fit: state.fit,
      background: state.background,
      threshold: state.threshold,
    };
    const worker = new Worker(new URL("./worker.js", import.meta.url), {
      type: "module",
    });
    state.worker = worker;
    busy(true);
    $("preview-state").textContent = "Generating on your device";
    $("progress-text").textContent = "Starting simulation…";
    $("progress").value = 0;
    worker.onerror = () => {
      worker.terminate();
      state.worker = null;
      busy(false);
      message(
        "The background worker could not finish. Try a smaller grid or shorter sequence.",
      );
      $("preview-state").textContent = state.result
        ? "Previous generation"
        : "Ready to explore";
    };
    worker.onmessage = ({ data }) => {
      if (data.type === "progress") {
        $("progress").value = Math.round((data.index / data.total) * 100);
        $("progress-text").textContent =
          `${data.label} · ${Math.round((data.index / data.total) * 100)}%`;
        $("frame-label").textContent = data.label;
        draw(data.pixels, config.size);
        $("dimensions").textContent = `${config.size}² lattice`;
      }
      if (data.type === "error") {
        worker.terminate();
        state.worker = null;
        busy(false);
        message(data.message);
        $("preview-state").textContent = state.result
          ? "Previous generation"
          : "Ready to explore";
        if (state.result) showFrame(state.frame);
      }
      if (data.type === "complete") {
        worker.terminate();
        state.worker = null;
        if (state.gifUrl) URL.revokeObjectURL(state.gifUrl);
        state.result = { ...data, imageSettings, treatment };
        state.dirty = false;
        state.gifUrl = URL.createObjectURL(
          new Blob([data.gif], { type: "image/gif" }),
        );
        $("download-gif").href = state.gifUrl;
        $("download-gif").download = `ising-morph-seed-${config.seed}.gif`;
        $("download-gif").hidden = false;
        $("scrub").max = data.labels.length - 1;
        $("download-png").disabled = false;
        busy(false);
        $("stale-note").hidden = true;
        $("preview-state").textContent = "Ready to export";
        $("result-title").textContent = "Your animation is ready.";
        $("result-description").textContent =
          `${(data.labels.length / config.fps).toFixed(1)} seconds · ${data.labels.length} frames · ${config.size * config.scale} × ${config.size * config.scale} pixels · ${(data.gif.byteLength / 1024 / 1024).toFixed(2)} MB`;
        const firstHold = data.labels.findIndex(
          (label) => label === "Holding image 1",
        );
        const firstImage =
          firstHold >= 0
            ? firstHold
            : data.labels.lastIndexOf("Forming image 1");
        showFrame(Math.max(0, firstImage));
      }
    };
    worker.postMessage(
      { config, targets },
      targets.map((t) => t.buffer),
    );
  } catch (e) {
    message(e.message);
  }
}
function cancel() {
  state.worker?.terminate();
  state.worker = null;
  busy(false);
  stopPlayback();
  message("Generation cancelled. You can change the settings and try again.");
  $("preview-state").textContent = state.result
    ? "Previous generation"
    : "Ready to explore";
  if (state.result) showFrame(state.frame);
  else idlePreview();
}
function savePNG() {
  if (!state.result || state.busy) return;
  stopPlayback();
  showFrame(state.frame);
  const c = document.createElement("canvas");
  c.width = c.height = 1024;
  const x = c.getContext("2d");
  x.imageSmoothingEnabled = false;
  x.drawImage(canvas, 0, 0, 1024, 1024);
  c.toBlob((blob) => {
    if (blob)
      download(
        blob,
        `ising-morph-seed-${state.result.config.seed}-frame-${state.frame + 1}.png`,
      );
  }, "image/png");
}
function saveSettings() {
  const r = state.result && !state.dirty ? state.result : null;
  const recipe = {
    app: "Ising Morph",
    version: VERSION,
    config: r ? r.config : { ...state.config },
    treatment: r
      ? r.treatment
      : {
          fit: state.fit,
          background: state.background,
          threshold: state.threshold,
        },
    images: r
      ? r.imageSettings
      : state.images.map((i) => ({
          name: i.name,
          invert: i.invert,
          binary: i.binary,
        })),
    note: "Select the same original images in this order. Image files are not included.",
  };
  download(
    new Blob([JSON.stringify(recipe, null, 2) + "\n"], {
      type: "application/json",
    }),
    `ising-morph-settings-seed-${recipe.config.seed}.json`,
  );
  message(
    "Settings saved. Keep the original images too; they are not embedded in this file.",
  );
}
async function loadSettings(file) {
  if (!file || state.busy) return;
  try {
    if (file.size > 100000)
      throw new Error("Choose an Ising Morph settings file under 100 KB.");
    const recipe = JSON.parse(await file.text());
    if (recipe.app !== "Ising Morph" || recipe.version !== VERSION)
      throw new Error(
        "Choose a settings file for this version of Ising Morph.",
      );
    const config = validateConfig(recipe.config),
      t = recipe.treatment;
    if (
      !t ||
      !["contain", "cover"].includes(t.fit) ||
      !["black", "white"].includes(t.background) ||
      !Number.isFinite(t.threshold) ||
      t.threshold < 0.1 ||
      t.threshold > 0.9
    )
      throw new Error("Invalid image treatment settings.");
    if (
      !Array.isArray(recipe.images) ||
      recipe.images.length > 8 ||
      recipe.images.some(
        (i) =>
          typeof i.name !== "string" ||
          typeof i.invert !== "boolean" ||
          typeof i.binary !== "boolean",
      )
    )
      throw new Error("Invalid image settings.");
    schedule(config, recipe.images.length || 1);
    // Match repeated filenames by occurrence; never apply one file's treatment to another.
    const available = [...state.images],
      ordered = [];
    for (const saved of recipe.images) {
      const index = available.findIndex((i) => i.name === saved.name);
      if (index >= 0) {
        const [image] = available.splice(index, 1);
        image.invert = saved.invert;
        image.binary = saved.binary;
        ordered.push(image);
      }
    }
    state.images = [...ordered, ...available];
    state.config = config;
    Object.assign(state, {
      fit: t.fit,
      background: t.background,
      threshold: t.threshold,
    });
    syncControls();
    renderImages();
    markDirty();
    message(
      "Settings loaded. Check that your original images and their order match: " +
        recipe.images.map((i) => i.name).join(" → "),
    );
  } catch (e) {
    message(e.message || "Could not read that settings file.");
  }
}

$("file-input").addEventListener("change", async (e) => {
  await addFiles(e.target.files);
  e.target.value = "";
});
for (const event of ["dragenter", "dragover"])
  $("drop-zone").addEventListener(event, (e) => {
    e.preventDefault();
    if (!state.busy) $("drop-zone").classList.add("is-over");
  });
for (const event of ["dragleave", "drop"])
  $("drop-zone").addEventListener(event, (e) => {
    e.preventDefault();
    $("drop-zone").classList.remove("is-over");
  });
$("drop-zone").addEventListener("drop", (e) => addFiles(e.dataTransfer.files));
$("examples").addEventListener("click", loadExamples);
$("motion-preset").addEventListener("change", () => {
  const preset = PRESETS[$("motion-preset").value];
  if (!preset || state.busy) return;
  state.config = {
    ...preset,
    seed: state.config.seed,
    scale: state.config.scale,
    loop: state.config.loop,
  };
  syncControls();
  renderImages();
  markDirty();
});
$("clear-images").addEventListener("click", () => {
  if (state.busy) return;
  state.images.forEach((i) => URL.revokeObjectURL(i.url));
  state.images = [];
  renderImages();
  markDirty();
});
for (const el of document.querySelectorAll("[data-config]"))
  el.addEventListener("input", () => {
    state.config[el.dataset.config] = Number(el.value);
    syncControls();
    markDirty();
  });
for (const key of ["size", "scale", "fps", "seed"])
  $(key).addEventListener("change", () => {
    state.config[key] = Number($(key).value);
    syncControls();
    markDirty();
  });
$("outro").addEventListener("change", () => {
  state.config.outro = $("outro").checked;
  markDirty();
});
$("loop").addEventListener("change", () => {
  state.config.loop = $("loop").value === "yes";
  markDirty();
});
document.querySelectorAll('input[name="mode"]').forEach((el) =>
  el.addEventListener("change", () => {
    state.config.mode = el.value;
    syncControls();
    markDirty();
  }),
);
for (const key of ["fit", "background"])
  $(key).addEventListener("change", () => {
    state[key] = $(key).value;
    renderImages();
    markDirty();
  });
$("threshold").addEventListener("input", () => {
  state.threshold = Number($("threshold").value);
  $("threshold-value").textContent = state.threshold;
  renderImages();
  markDirty();
});
$("reset").addEventListener("click", () => {
  state.config = { ...DEFAULTS };
  state.fit = "contain";
  state.background = "black";
  state.threshold = 0.5;
  syncControls();
  renderImages();
  markDirty();
  message("Animation settings reset. Your images are kept.");
});
$("generate").addEventListener("click", generate);
$("cancel").addEventListener("click", cancel);
$("play").addEventListener("click", play);
$("scrub").addEventListener("input", () => {
  stopPlayback();
  showFrame(Number($("scrub").value));
});
$("download-png").addEventListener("click", savePNG);
$("save-settings").addEventListener("click", saveSettings);
$("load-settings").addEventListener("change", async (e) => {
  await loadSettings(e.target.files[0]);
  e.target.value = "";
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopPlayback();
});
window.addEventListener("beforeunload", () => {
  state.worker?.terminate();
  state.images.forEach((i) => URL.revokeObjectURL(i.url));
  if (state.gifUrl) URL.revokeObjectURL(state.gifUrl);
});
syncControls();
loadExamples();
