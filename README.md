# Ising Morph

Create image-guided Ising animations in your browser. Arrange up to eight
images, explore two transition styles, and save a GIF or a still PNG.

**[Open the app](https://drknwmn.github.io/IsingMorph/)**

## Use it

1. Try the built-in circle → star → heart sequence, or select PNG/JPG/WebP images.
2. Reorder the images with the arrows. Inversion is initially chosen from the
   image border; adjust **Invert** and **Binary mask** per image as needed.
3. Pick **Dissolve & reform** or **Direct morph**, then adjust formation, hold,
   dissolve, and fluctuation times in seconds.
4. Generate. The simulation and GIF encoding run in a dedicated browser worker.
   You can cancel a job immediately. Lower grid sizes are faster.
5. Play or scrub the result. Download the GIF, or export the selected frame as
   a 1024 × 1024 PNG. Pixel enlargement does not add simulation detail.

Settings files record the app version, seed, image names, image treatment, and
animation controls. They do **not** include your original images. Keep those
files and select them in the recorded order to reproduce an animation. Matching
filenames have their inversion/mask controls restored when settings are loaded.
Changing settings leaves the previous result available and marks it as stale.

## Privacy and hosting

The application is a static website. Image decoding, simulation, previews,
and exports happen in the browser. There are no accounts, API keys, model
services, image uploads, analytics, third-party fonts, or runtime CDNs. Files and
results exist only in the current tab's memory; reloading clears them. Download
anything you want to keep. The hosting provider still receives ordinary page
requests, as with any website.

GitHub Pages serves HTML, CSS, JavaScript, and the browser worker. A worker is
an execution thread on the visitor's device; no server or cloud worker is used.

## Model and interpretation

Nearest-neighbor ferromagnetic Ising spins on a square lattice with periodic
boundaries, coupling J = 1, and kB = 1. One sweep makes L² random single-spin
attempts, accepted by the Metropolis rule. A seeded pseudorandom generator
drives initialization and every subsequent attempt. Frames sample the lattice
after a configurable number of sweeps.

Images are composited over a chosen background, fit or cropped to a square,
converted to grayscale, optionally inverted and thresholded, and mapped to
fields in [-1, 1]. Field strength ramps smoothly as each target forms. In
dissolve mode the field falls to zero between targets. Direct mode interpolates
the spatial field while retaining its strength. These are image-guided,
finite-size, nonequilibrium visualizations. The zero-field critical temperature
2 / ln(1 + sqrt(2)) ≈ 2.269 is a reference; a nonzero image field is not a
demonstration of the zero-field thermodynamic phase transition. Animation
seconds and simulation sweeps are not physical time.

GIF timing uses cumulative centisecond rounding. Some viewers may clamp short
frame delays. Looping repeats the saved sequence; it does not guarantee an
identical lattice at the first and last frame. Low-resolution runs are previews
of this model, not scientifically converged sampling.

## Develop

Node.js 22 or later:

```sh
npm ci
npm test
npm run dev
```

Production build and preview:

```sh
npm run build
npm run preview
```

The relative build base works at `/IsingMorph/` or another static subdirectory.
The worker and encoder are bundled as local assets. Deploy `dist/`; do not
publish `node_modules/`.

## Deployment

Enable GitHub Pages with **GitHub Actions** as the source. Pushes to `main`
run tests, build, and deploy. Pull requests run checks without deployment.
The repository starts a new history; it contains no earlier application
commits, project links, generated banners, or service configuration.

The portfolio links to the standalone app. It does not need the app's build
dependencies or simulation code.

## Limits

- Eight images; 12 MB per image; 24 megapixels per decoded image.
- Grid sizes from 64 to 256; repeatable runs use the same version, input
  pixels, image treatment, order, configuration, and seed. Image decoding or
  resampling can vary slightly between browsers; use the same browser for
  pixel-identical reproductions.
- Requests are capped at 64 MiB of indexed frame storage and 160 million
  encoded pixels. Use a smaller grid, GIF scale, or shorter sequence if needed.
- Current export is black-and-white GIF and PNG. Photos generally need more
  contrast or a binary mask. Very thin lines may disappear at small grids.

MIT license. GIF encoding uses gifenc; see THIRD_PARTY_NOTICES.md.
