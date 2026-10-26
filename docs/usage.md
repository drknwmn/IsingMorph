# Using Ising Morph

[Open the studio](https://drknwmn.github.io/IsingMorph/) · [Back to README](../README.md)

## Built-in examples

**Neuron → brain → person** is ready on first load. Click **Generate animation**
to simulate it; the app generates every frame rather than playing a saved GIF.
The **Original sequence** button replaces the current images and resets all
animation and image-treatment settings to Original flow, seed 7, and 2× GIF scale.

Original flow uses a 180 × 180 lattice, 24 fps, and two sweeps per frame.
For the three-image sequence it produces 514 frames, about 21.4 seconds, with
field-free fluctuations before, between, and after the images. It follows the
original notebook's timing and texture rather than reproducing its exact pixels.

**Simple shapes** replaces the sequence with circle → star → heart, keeping
current settings. **Quick preview** changes resolution and timing for faster
iteration without replacing your images. You can change either example's order,
remove an image, or add your own files. **Clear** removes all images.

## Your own images

1. Choose or drop up to eight PNG, JPG, or WebP files. Files are appended to
   the sequence. Each must be under 12 MB and 24 megapixels.
2. Reorder with the arrows. **Invert** is initially inferred from the border
   brightness; check the processed thumbnail and adjust it if needed.
3. For silhouettes and line drawings, use a **Binary mask** if the result
   looks washed out. Its threshold is under **Image treatment & advanced controls**.
4. Choose **Fit whole image** or **Crop to fill**. These preserve aspect ratio.
   Transparent areas are composited over the chosen dark or light background.
5. Select a transition style, adjust timings, and generate.

For thin, dark lines on a light background, try **Invert**, a **256 × 256** grid,
image guidance **3**, and a binary mask threshold of **0.35**. These settings
worked for a separate fine-line neuron input; other images need visual tuning.
Start with Quick preview when exploring. Larger grids and more dynamics per
frame increase computation.

## Playback and exports

Play the completed sequence or scrub to a specific frame. GIF downloads use
the chosen scale and repeat setting. Still PNGs save the selected frame at
1024 × 1024 with crisp pixel enlargement. Larger exports do not increase the
number of simulated spins.

Changing controls keeps the previous result visible and marks it as stale.
Generate again to apply changes. **Reset animation settings** keeps your images.
**Original sequence** also replaces images and restores their original treatment.

GIF delays use cumulative centisecond rounding; some viewers clamp short delays.
Repeat loops the sequence without guaranteeing an identical first and last lattice.

## Keep a reproducible recipe

**Save settings** records the app/model version, seed, image names, inversion,
mask treatment, framing, and animation controls. Image files are not embedded.

To recreate a custom result, select the same original files, load the saved
settings, check their order, and generate. Matching filenames have their
order and per-image controls restored. Duplicate filenames are matched by
occurrence. Use the same browser for pixel-identical image resampling.

For the built-in original sequence, click **Original sequence** before loading
its saved recipe. A copy of the [documented Original flow recipe](original-flow.json)
is included in this repository. The simulation/configuration version remains
1.1.0 because this update changes examples and documentation, not dynamics.

## Limits and session lifetime

- Up to eight images; 12 MB and 24 megapixels per image.
- Simulation grids: 64, 128, 180, 192, or 256 pixels per side.
- At most 64 MiB of indexed frame storage and 160 million encoded pixels per run.
  If a sequence exceeds the cap, shorten timings or reduce grid size or GIF scale.
- Files and results live in the current tab's memory. Reloading or closing
  clears them. Download outputs, recipes, and any custom source images you need.
- The simulation is a visual tool; see [model and interpretation](model.md)
  before using it to explain physics.
