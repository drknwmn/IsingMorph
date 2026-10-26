# Model and interpretation

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

Original flow restores the original lattice resolution and approximately the
same number of sweeps in each phase, with a short image hold for readability.
Field strength uses eased ramps; temperature uses linear ramps. The initial
and final field-free intervals allow clusters to develop before an image
forms and before the lattice reheats. The random generator and browser image
resampling differ from the original Python notebook, so this matches its
visual timing and texture rather than reproducing its exact pixels.

GIF timing uses cumulative centisecond rounding. Some viewers may clamp short
frame delays. Looping repeats the saved sequence; it does not guarantee an
identical lattice at the first and last frame. Low-resolution runs are previews
of this model, not scientifically converged sampling.

## Implementation

- [`src/engine.js`](../src/engine.js): seeded lattice updates, transition schedule, and resource limits.
- [`src/worker.js`](../src/worker.js): simulation, preview frames, and GIF encoding.
- [`src/main.js`](../src/main.js): image treatment, playback, and downloads.

The built-in original sequence uses the same engine as uploaded images. No prerecorded frames are used by the app.
