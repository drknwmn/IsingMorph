# Original example assets

The built-in sequence comes from the original Ising Morph notebook project.
These are the exact input PNGs used to tune the browser version; they are
copied unchanged, with shorter filenames for the web app.

| Bundled file | Original project filename | Dimensions | SHA-256 |
| --- | --- | --- | --- |
| [neuron.png](../public/examples/original/neuron.png) | `neuron (1).png` | 1024 × 1024 | `298fe28977fe969c238c430f753475a56c56e4735e25d24226703f832483a133` |
| [brain.png](../public/examples/original/brain.png) | `brain (2).png` | 768 × 768 | `c31ad66e0e292539cb1be38271ebee088c6e81fbe7d894e6b6c0f60f62fb4cf5` |
| [person.png](../public/examples/original/person.png) | `human (1).png` | 768 × 768 | `41da9a8c1c20b4e3d5aa580521225886ed0076960b54f96c8db5002486cd059b` |

All three are grayscale silhouettes on black backgrounds. No creator or
external-source metadata is embedded in the original PNG files. They are
visual examples, not anatomical measurements or a neuroscience dataset.

The README animation was exported by the browser app with Original flow
settings, seed 7, and these inputs: 180 × 180 lattice, 24 fps, two sweeps per
frame, 2× GIF scale, 514 frames. The filmstrip samples frames from that export.
The browser version matches the original notebook's visual timing and texture;
its random sequence and image resampling differ.

Circle, star, and heart are drawn by the application's own canvas code.
