# Vocal Tract Synth

A playable physical model of a human throat, mouth and nose: a Kelly-Lochbaum waveguide tract
driven by an LF glottal source, with envelopes, LFOs, a mod matrix, MPE, and a phrase singer
that sings typed words across the notes you play.

- `Source/VTEngine.h` - the sound engine in C++ (a line-for-line port of `web/src/engine.js`)
- `Source/PluginProcessor.*`, `Source/PluginEditor.*` - the JUCE plugin (VST3, AU, Standalone)
- `ui/index.html` - the plugin window; generated, do not edit by hand
- `web/` - the browser version and the shared interface source (`web/src`); run `python3 web/build.py` after editing it
- `test/` - renders the same scenarios in C++ and JavaScript to check they match

GitHub Actions builds a universal macOS zip on every push (Actions tab > latest run > Artifacts).
See `INSTALL.txt` for installing it.
