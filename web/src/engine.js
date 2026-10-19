/* Vocal tract synth engine: portable DSP (no DOM, no allocation in the audio loop).
 * Kelly-Lochbaum waveguide tract + LF glottal source, polyphonic, runs at 2x oversampling. */
function EngineFactory() {
  'use strict';
  const PI = Math.PI, TAU = PI * 2, C = 34300; // C = speed of sound, cm/s
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /* ---- vowel presets: tongue place (x), constriction (y), tongue width (w), lips, pharynx ---- */
  const VOWELS = /*@VOWELS@*/{"i":{"x":0.688,"y":0.166,"w":0.735,"lips":1,"phar":0.481,"vel":0},"ɪ":{"x":0.588,"y":0.31,"w":0.571,"lips":0.954,"phar":0.38,"vel":0},"ɛ":{"x":0.628,"y":0.516,"w":0.45,"lips":1,"phar":0.144,"vel":0},"æ":{"x":0.594,"y":0.657,"w":0.318,"lips":1,"phar":0,"vel":0},"ɑ":{"x":0.164,"y":0.304,"w":0.562,"lips":0.76,"phar":0.072,"vel":0},"ɔ":{"x":0.176,"y":0.121,"w":0.449,"lips":0.443,"phar":0.253,"vel":0},"ʊ":{"x":0.195,"y":0.326,"w":0.081,"lips":0.32,"phar":0.352,"vel":0},"u":{"x":0.53,"y":0.033,"w":0,"lips":0.087,"phar":0.221,"vel":0},"ʌ":{"x":0.191,"y":0.478,"w":0.489,"lips":0.684,"phar":0.216,"vel":0},"ə":{"x":0.542,"y":0.562,"w":0.47,"lips":0.741,"phar":0.354,"vel":0}}/*@END@*/;
  const GRID = /*@GRID@*/{"NU":15,"NV":13,"d":[0.683,0.166,0.6,0.93,0.431,0.683,0.165,0.595,0.924,0.406,0.702,0.165,0.502,0.854,0.406,0.718,0.165,0.433,0.793,0.408,0.74,0.16,0.356,0.724,0.397,0.757,0.151,0.283,0.665,0.398,0.774,0.14,0.208,0.607,0.397,0.79,0.116,0.129,0.549,0.391,0.806,0.098,0.069,0.488,0.388,0.821,0.09,0.024,0.438,0.382,0.945,0.196,0.024,0.459,0.38,0.987,0.244,0.006,0.472,0.365,1,0.244,0,0.473,0.332,1,0.244,0,0.456,0.289,1,0.242,0,0.445,0.257,0.583,0.171,0.59,0.942,0.386,0.589,0.186,0.572,0.92,0.404,0.596,0.186,0.521,0.869,0.409,0.602,0.193,0.476,0.815,0.418,0.61,0.191,0.421,0.753,0.418,0.616,0.191,0.368,0.698,0.424,0.616,0.19,0.323,0.647,0.431,0.621,0.185,0.27,0.593,0.428,0.621,0.174,0.222,0.541,0.422,0.621,0.169,0.184,0.48,0.415,0.616,0.176,0.156,0.431,0.421,0.604,0.171,0.136,0.387,0.409,0.586,0.152,0.112,0.349,0.385,0.571,0.131,0.088,0.3,0.344,0.554,0.112,0.063,0.259,0.32,0.597,0.252,0.565,0.955,0.391,0.597,0.257,0.559,0.917,0.399,0.596,0.26,0.529,0.869,0.41,0.596,0.26,0.486,0.823,0.415,0.596,0.26,0.447,0.77,0.416,0.596,0.26,0.406,0.721,0.422,0.596,0.266,0.369,0.661,0.432,0.596,0.26,0.32,0.61,0.423,0.591,0.262,0.29,0.556,0.422,0.586,0.257,0.251,0.501,0.413,0.579,0.251,0.212,0.447,0.4,0.566,0.243,0.179,0.395,0.387,0.554,0.23,0.132,0.347,0.361,0.534,0.202,0.099,0.301,0.322,0.504,0.176,0.075,0.261,0.289,0.623,0.338,0.543,0.953,0.388,0.607,0.338,0.542,0.921,0.398,0.594,0.332,0.523,0.88,0.404,0.59,0.333,0.498,0.829,0.41,0.588,0.337,0.467,0.778,0.417,0.583,0.337,0.431,0.726,0.416,0.585,0.344,0.392,0.666,0.42,0.578,0.344,0.358,0.614,0.42,0.573,0.344,0.319,0.556,0.409,0.566,0.342,0.277,0.504,0.4,0.553,0.338,0.238,0.453,0.387,0.54,0.326,0.197,0.398,0.357,0.519,0.305,0.151,0.354,0.326,0.493,0.268,0.108,0.312,0.289,0.46,0.223,0.088,0.284,0.259,0.633,0.413,0.521,0.975,0.367,0.616,0.413,0.524,0.938,0.376,0.596,0.41,0.521,0.896,0.391,0.585,0.405,0.503,0.84,0.393,0.58,0.409,0.475,0.785,0.396,0.576,0.419,0.449,0.731,0.401,0.574,0.427,0.416,0.672,0.405,0.56,0.424,0.385,0.618,0.401,0.552,0.431,0.348,0.559,0.393,0.539,0.436,0.315,0.506,0.382,0.526,0.431,0.271,0.457,0.359,0.498,0.417,0.235,0.41,0.335,0.464,0.392,0.191,0.367,0.312,0.279,0.365,0.136,0.32,0.339,0.25,0.291,0.146,0.294,0.328,0.633,0.479,0.497,0.989,0.335,0.622,0.491,0.501,0.953,0.352,0.602,0.493,0.502,0.911,0.369,0.587,0.497,0.496,0.859,0.381,0.574,0.498,0.484,0.804,0.386,0.56,0.501,0.468,0.749,0.389,0.554,0.508,0.439,0.691,0.383,0.539,0.515,0.416,0.633,0.378,0.523,0.525,0.393,0.576,0.374,0.5,0.528,0.372,0.527,0.364,0.46,0.525,0.346,0.479,0.353,0.339,0.519,0.297,0.423,0.359,0.258,0.438,0.251,0.38,0.352,0.222,0.337,0.227,0.353,0.348,0.214,0.258,0.231,0.339,0.337,0.629,0.539,0.469,1,0.289,0.615,0.555,0.48,0.968,0.308,0.601,0.569,0.488,0.927,0.33,0.582,0.573,0.492,0.875,0.343,0.563,0.582,0.485,0.823,0.357,0.546,0.58,0.481,0.77,0.351,0.522,0.585,0.468,0.714,0.353,0.503,0.589,0.458,0.66,0.352,0.469,0.592,0.443,0.612,0.351,0.417,0.59,0.436,0.562,0.357,0.336,0.56,0.41,0.503,0.359,0.254,0.487,0.361,0.453,0.359,0.221,0.384,0.324,0.422,0.35,0.207,0.292,0.31,0.397,0.336,0.196,0.215,0.312,0.384,0.328,0.625,0.598,0.45,1,0.231,0.611,0.615,0.457,0.977,0.249,0.586,0.63,0.474,0.943,0.278,0.564,0.638,0.479,0.899,0.291,0.537,0.649,0.486,0.851,0.306,0.507,0.647,0.49,0.797,0.314,0.479,0.647,0.49,0.747,0.319,0.434,0.637,0.491,0.696,0.323,0.382,0.625,0.487,0.643,0.334,0.318,0.584,0.469,0.588,0.344,0.259,0.509,0.439,0.535,0.344,0.225,0.414,0.41,0.493,0.34,0.206,0.32,0.392,0.464,0.329,0.189,0.231,0.377,0.441,0.322,0.175,0.156,0.375,0.426,0.312,0.616,0.647,0.437,1,0.164,0.595,0.667,0.446,0.986,0.187,0.567,0.685,0.461,0.954,0.21,0.536,0.696,0.473,0.913,0.229,0.501,0.704,0.487,0.873,0.251,0.456,0.689,0.499,0.831,0.266,0.409,0.673,0.51,0.779,0.279,0.349,0.646,0.513,0.724,0.292,0.291,0.6,0.502,0.671,0.306,0.253,0.525,0.488,0.616,0.309,0.221,0.43,0.465,0.562,0.309,0.2,0.339,0.443,0.533,0.309,0.191,0.257,0.442,0.507,0.306,0.173,0.178,0.433,0.485,0.298,0.163,0.112,0.434,0.457,0.281,0.598,0.695,0.429,1,0.097,0.573,0.718,0.434,0.995,0.115,0.537,0.729,0.452,0.963,0.137,0.494,0.737,0.477,0.929,0.158,0.441,0.73,0.494,0.891,0.177,0.383,0.702,0.513,0.855,0.205,0.328,0.665,0.525,0.805,0.225,0.278,0.6,0.52,0.75,0.246,0.238,0.525,0.509,0.688,0.259,0.216,0.439,0.503,0.643,0.266,0.202,0.355,0.491,0.605,0.27,0.184,0.275,0.482,0.572,0.268,0.167,0.196,0.479,0.54,0.266,0.154,0.129,0.473,0.512,0.25,0.15,0.075,0.468,0.478,0.224,0.573,0.739,0.429,1,0.033,0.541,0.756,0.439,1,0.048,0.493,0.764,0.459,0.976,0.067,0.436,0.758,0.486,0.943,0.087,0.376,0.725,0.506,0.908,0.107,0.314,0.677,0.523,0.869,0.14,0.26,0.611,0.531,0.818,0.167,0.231,0.531,0.531,0.759,0.185,0.208,0.445,0.522,0.711,0.202,0.196,0.364,0.52,0.675,0.216,0.179,0.282,0.514,0.635,0.224,0.162,0.208,0.51,0.606,0.229,0.155,0.144,0.509,0.575,0.22,0.147,0.095,0.503,0.535,0.193,0.147,0.048,0.482,0.486,0.155,0.517,0.773,0.44,1,0,0.485,0.78,0.453,1,0,0.428,0.774,0.483,0.984,0.011,0.363,0.743,0.505,0.956,0.03,0.299,0.691,0.526,0.923,0.054,0.25,0.618,0.538,0.876,0.083,0.22,0.537,0.535,0.828,0.101,0.205,0.456,0.538,0.781,0.129,0.181,0.366,0.537,0.734,0.149,0.175,0.296,0.541,0.701,0.157,0.162,0.222,0.542,0.672,0.169,0.151,0.162,0.537,0.641,0.176,0.142,0.098,0.529,0.6,0.171,0.147,0.084,0.513,0.546,0.134,0.147,0.048,0.494,0.486,0.155,0.455,0.794,0.466,1,0,0.408,0.781,0.481,1,0,0.346,0.753,0.509,1,0,0.288,0.702,0.535,0.972,0,0.241,0.631,0.545,0.934,0.017,0.219,0.553,0.546,0.891,0.035,0.198,0.474,0.545,0.845,0.06,0.185,0.389,0.551,0.801,0.083,0.169,0.307,0.558,0.761,0.103,0.161,0.238,0.569,0.724,0.121,0.146,0.175,0.565,0.687,0.13,0.151,0.122,0.546,0.653,0.121,0.142,0.098,0.554,0.6,0.14,0.147,0.084,0.521,0.546,0.134,0.147,0.048,0.494,0.486,0.155]}/*@END@*/;   // smooth articulation map over the vowel trapezoid
  const VOWEL_ORDER = ['i', 'ɪ', 'ɛ', 'æ', 'ɑ', 'ɔ', 'ʊ', 'u', 'ʌ', 'ə'];
  // nominal formants (Hz) of an adult male, used for the vowel chart and for tuning
  const VOWEL_FORMANTS = {
    'i': [270, 2290, 3010], 'ɪ': [390, 1990, 2550], 'ɛ': [530, 1840, 2480], 'æ': [660, 1720, 2410],
    'ɑ': [730, 1090, 2440], 'ɔ': [570, 840, 2410], 'ʊ': [440, 1020, 2240], 'u': [300, 870, 2240],
    'ʌ': [640, 1190, 2390], 'ə': [500, 1500, 2500]
  };

  const DEFAULTS = {
    // mouth (base shape)
    x: 0.5, y: 0.5, w: 0.5, lips: 0.5, phar: 0.5, vel: 0, tip: 1,
    morph: 0, bx: 0.688, by: 0.166, bw: 0.735, blips: 1, bphar: 0.481, bvel: 0,   // morph target defaults to /i/
    // source
    tension: 0.6, breath: 0.12, fric: 0, vib: 22, vibRate: 5.4, vibDelay: 350, human: 0.35,
    // size
    length: 17.5, larynx: 0, tune: 0.5,
    // amp envelope (env 1)
    attack: 25, decay: 400, sustain: 1, release: 170,
    // mod envelopes
    e2a: 5, e2d: 220, e2s: 0, e2r: 200, e2loop: 0,
    e3a: 400, e3d: 800, e3s: 0.6, e3r: 500, e3loop: 0,
    // LFOs: shape 0 sine 1 triangle 2 saw 3 square 4 sample&hold 5 drift
    l1shape: 0, l1rate: 3, l1sync: 0, l1div: 4, l1amt: 1, l1retrig: 1,
    l2shape: 5, l2rate: 0.6, l2sync: 0, l2div: 2, l2amt: 1, l2retrig: 0,
    bpm: 120,
    // play
    mono: 0, legRetrig: 0, glideMode: 0, prio: 0, glide: 90, bend: 2, mpe: 0, mpeBend: 48,
    voices: 6, artTime: 30, spread: 0.5,
    // phrase
    phOn: 0, phAuto: 1, phWait: 650, phLen: 380, phLoop: 1, phReset: 2.5, phCons: 0.85,
    // output
    master: 0.75, room: 0.18, bright: 0.85
  };

  /* ---- modulation matrix: sources x destinations ---- */
  const MOD_SRC = ['env2', 'env3', 'lfo1', 'lfo2', 'vel', 'note', 'mw', 'press', 'slide', 'bend', 'rand'];
  const MOD_DST = ['pitch', 'amp', 'pan', 'x', 'y', 'w', 'lips', 'phar', 'vel', 'tip', 'length', 'larynx',
    'tension', 'breath', 'fric', 'vib', 'morph', 'l1rate', 'l1amt', 'l2rate', 'l2amt'];
  const NS = MOD_SRC.length, ND = MOD_DST.length;
  const SI = {}, DI = {};
  MOD_SRC.forEach((s, i) => { SI[s] = i; }); MOD_DST.forEach((d, i) => { DI[d] = i; });
  // what one unit of modulation means for each destination
  const DST_SCALE = { pitch: 24, amp: 1, pan: 1, x: 1, y: 1, w: 1, lips: 1, phar: 1, vel: 1, tip: 1, length: 8, larynx: 1,
    tension: 1, breath: 1, fric: 1, vib: 60, morph: 1, l1rate: 4, l1amt: 1, l2rate: 4, l2amt: 1 };
  const DEFAULT_MODS = [['mw', 'morph', 1], ['press', 'y', 0.3], ['press', 'amp', 0.3], ['press', 'tension', 0.2], ['slide', 'x', 0.35]];
  const LFO_DIVS = [16, 8, 4, 2, 1, 0.5, 0.25, 2 / 3, 1 / 3, 1 / 6];   // beats per cycle
  const LFO_DIV_NAMES = ['4 bars', '2 bars', '1 bar', '1/2', '1/4', '1/8', '1/16', '1/4T', '1/8T', '1/16T'];

  /* ---- phonemes (ARPAbet) ---- */
  const VMAP = { AA: 'ɑ', AE: 'æ', AH: 'ʌ', AX: 'ə', AO: 'ɔ', EH: 'ɛ', IH: 'ɪ', IY: 'i', UH: 'ʊ', UW: 'u' };
  const VCUSTOM = { ER: { x: 0.62, y: 0.3, w: 0.45, lips: 0.38, phar: 0.1 } };
  const DIPH = { AW: ['AA', 'UH'], AY: ['AA', 'IY'], EY: ['EH', 'IY'], OW: ['AO', 'UH'], OY: ['AO', 'IY'] };
  // consonants: o = shape overrides on top of the neighbouring vowel; vo voicing; fr hiss; asp breath; bu burst on release
  const CONS = {
    P: { o: { lc: 1 }, vo: 0, dur: 75, tt: 10, bu: 1 },
    B: { o: { lc: 1 }, vo: 0.45, dur: 60, tt: 10, bu: 0.5 },
    M: { o: { lc: 1, vel: 1 }, vo: 1, dur: 85, tt: 14 },
    F: { o: { lc: 0.8 }, vo: 0, fr: 0.75, dur: 105, tt: 16 },
    V: { o: { lc: 0.8 }, vo: 1, fr: 0.35, dur: 80, tt: 16 },
    TH: { o: { tip: 0.12 }, vo: 0, fr: 0.5, dur: 100, tt: 16 },
    DH: { o: { tip: 0.14 }, vo: 1, fr: 0.2, dur: 55, tt: 16 },
    T: { o: { tip: 0 }, vo: 0, dur: 60, tt: 9, bu: 1 },
    D: { o: { tip: 0 }, vo: 0.45, dur: 50, tt: 9, bu: 0.55 },
    N: { o: { tip: 0, vel: 1 }, vo: 1, dur: 80, tt: 14 },
    S: { o: { tip: 0.07 }, vo: 0, fr: 1, dur: 120, tt: 14 },
    Z: { o: { tip: 0.07 }, vo: 1, fr: 0.5, dur: 95, tt: 14 },
    SH: { o: { x: 0.84, y: 0.05, lips: 0.25 }, vo: 0, fr: 0.9, dur: 120, tt: 16 },
    ZH: { o: { x: 0.84, y: 0.05, lips: 0.25 }, vo: 1, fr: 0.45, dur: 95, tt: 16 },
    K: { o: { x: 0.6, y: -1 }, vo: 0, dur: 65, tt: 10, bu: 1 },
    G: { o: { x: 0.6, y: -1 }, vo: 0.45, dur: 55, tt: 10, bu: 0.55 },
    NG: { o: { x: 0.6, y: -1, vel: 1 }, vo: 1, dur: 90, tt: 14 },
    L: { o: { tip: 0.16, w: 0.85 }, vo: 1, dur: 70, tt: 24 },
    R: { o: { x: 0.62, y: 0.28, lips: 0.3, phar: 0.1 }, vo: 1, dur: 70, tt: 30 },
    W: { o: { x: 0.28, y: 0.14, lips: 0, w: 0.1 }, vo: 1, dur: 65, tt: 32 },
    Y: { o: { x: 0.82, y: 0.04, lips: 1 }, vo: 1, dur: 55, tt: 30 },
    HH: { o: {}, vo: 0, asp: 1, dur: 70, tt: 20 }
  };
  const AFFRIC = { CH: ['T', 'SH'], JH: ['D', 'ZH'] };
  const PHONE_KEYS = ['x', 'y', 'w', 'lips', 'phar', 'vel', 'tip', 'lc'];
  function vowelShape(code, out) {
    const s = VCUSTOM[code] || VOWELS[VMAP[code] || 'ə'];
    out.x = s.x; out.y = s.y; out.w = s.w; out.lips = s.lips; out.phar = s.phar; out.vel = 0; out.tip = 1; out.lc = 0;
    return out;
  }

  /* ---- area function: articulation -> cross-section area (cm^2) per tract segment ---- */
  const AINFO = { xc: 0, sig: 0, c: 0, minA: 9, minI: 0 };
  function buildAreas(a, N, A) {
    const xc = 0.16 + 0.76 * a.x;                 // tongue-body constriction centre, fraction of tract from glottis
    const sig = 0.05 + 0.2 * a.w;                 // constriction spread
    const y = a.y;
    const c = y >= 0 ? 0.025 + 0.975 * y * y : 0.025 * (1 + Math.max(y, -1));   // y < 0 closes completely
    const ph = 0.55 + 1.1 * a.phar;               // pharynx scale
    const lipA = 0.35 * Math.pow(26, a.lips);     // 0.35 (rounded) .. 9 (open) cm^2
    const aL = 1.1 * Math.sqrt(ph), aP = 4.2 * ph, aO = 3.8 + 2.4 * clamp(y, 0, 1);   // mouth opens with the jaw
    const lipS0 = 0.86 - 0.12 * (1 - a.lips);     // rounded lips form a longer narrow tube
    const tip = a.tip === undefined ? 1 : clamp(a.tip, 0, 1);
    const ct = tip * tip, lc = a.lc ? clamp(a.lc, 0, 1) : 0;
    const inv2s = 1 / (2 * sig * sig), inv2t = 1 / (2 * 0.032 * 0.032);
    let minA = 99, minI = 0;
    for (let i = 0; i < N; i++) {
      const x = (i + 0.5) / N;
      let ar = lerp(aL, aP, sstep(0.07, 0.15, x));
      ar = lerp(ar, aO, sstep(0.38, 0.5, x));
      ar = lerp(ar, lipA, sstep(lipS0, 0.97, x));
      const d = x - xc;
      ar *= 1 - Math.exp(-d * d * inv2s) * (1 - c);
      if (ct < 1) { const dt = x - 0.885; ar *= 1 - Math.exp(-dt * dt * inv2t) * (1 - ct); }
      if (lc > 0) ar *= 1 - sstep(0.93, 0.985, x) * lc;
      if (ar < 0.012) ar = 0.012;
      A[i] = ar;
      if (i > 2 && ar < minA) { minA = ar; minI = i; }
    }
    AINFO.xc = xc; AINFO.sig = sig; AINFO.c = c; AINFO.minA = minA; AINFO.minI = minI;
    return AINFO;
  }

  /* ---- waveguide tract ---- */
  class Tract {
    constructor(maxN, fsT) {
      this.maxN = maxN; this.fsT = fsT;
      const f = () => new Float64Array(maxN + 3);
      this.R = f(); this.L = f(); this.jR = f(); this.jL = f();
      this.A = f(); this.k1 = f(); this.k2 = f(); this.tmp = f();
      this.nR = f(); this.nL = f(); this.njR = f(); this.njL = f();
      this.nA = f(); this.nk1 = f(); this.nk2 = f();
      this.N = 0; this.NL = 0; this.ns = 2; this.noseOn = false;
      this.loss = 0.9994; this.gRefl = 0.75;
      this.lipC = 0.3; this.lipG = 0.96; this.lipS = 0; this.noseC = 0.25; this.noseS = 0;
      this.inj = 2;
    }
    reset() {
      this.R.fill(0); this.L.fill(0); this.jR.fill(0); this.jL.fill(0);
      this.nR.fill(0); this.nL.fill(0); this.njR.fill(0); this.njL.fill(0);
      this.lipS = 0; this.noseS = 0;
    }
    _resample(arr, oldN, N) {
      const t = this.tmp;
      for (let i = 0; i < N; i++) {
        const p = (i + 0.5) * oldN / N - 0.5;
        const i0 = Math.floor(p), fr = p - i0;
        const a = arr[clamp(i0, 0, oldN - 1)], b = arr[clamp(i0 + 1, 0, oldN - 1)];
        t[i] = a + (b - a) * fr;
      }
      for (let i = 0; i < N; i++) arr[i] = t[i];
      for (let i = N; i < oldN; i++) arr[i] = 0;
    }
    resize(N) {
      if (N === this.N) return;
      const oldN = this.N, oldNL = this.NL;
      if (oldN > 0) { this._resample(this.R, oldN, N); this._resample(this.L, oldN, N); }
      this.N = N;
      this.NL = Math.max(8, Math.round(0.62 * N));
      this.ns = clamp(Math.round(0.4 * N), 2, N - 3);
      if (oldNL > 0 && oldNL !== this.NL) { this._resample(this.nR, oldNL, this.NL); this._resample(this.nL, oldNL, this.NL); }
      // fixed nose shape (cm^2); element 0 is the velum port and is set per tick
      const NL = this.NL;
      for (let j = 1; j < NL; j++) this.nA[j] = 0.9 + 2.6 * Math.pow(Math.sin(PI * (j + 0.5) / NL), 0.6);
      for (let j = 2; j < NL; j++) {
        const s = this.nA[j - 1] + this.nA[j];
        this.nk1[j] = 2 * this.nA[j - 1] / s; this.nk2[j] = 2 * this.nA[j] / s;
      }
    }
    /* call after buildAreas wrote this.A[0..N-1] */
    setShape(port) {
      const N = this.N, A = this.A;
      for (let i = 1; i < N; i++) {
        const s = A[i - 1] + A[i];
        this.k1[i] = 2 * A[i - 1] / s; this.k2[i] = 2 * A[i] / s;
      }
      // lips: radiation corner depends on opening radius
      const rad = Math.sqrt(A[N - 1] / PI);
      const fc = clamp(0.62 * C / (TAU * rad), 1800, 14000);
      this.lipC = 1 - Math.exp(-TAU * fc / this.fsT);
      const on = port > 0.03;
      if (on) {
        this.nA[0] = port;
        const s = port + this.nA[1];
        this.nk1[1] = 2 * port / s; this.nk2[1] = 2 * this.nA[1] / s;
      } else if (this.noseOn) {
        this.nR.fill(0); this.nL.fill(0); this.njR.fill(0); this.njL.fill(0); this.noseS = 0;
      }
      this.noseOn = on;
    }
    step(src, fn) {
      const N = this.N, R = this.R, L = this.L, jR = this.jR, jL = this.jL, k1 = this.k1, k2 = this.k2, loss = this.loss;
      jR[0] = L[0] * this.gRefl + src;
      const rN = R[N - 1];
      this.lipS += this.lipC * (rN - this.lipS);
      const refl = -this.lipG * this.lipS;
      jL[N] = refl;
      let out = rN + refl;
      if (!this.noseOn) {
        for (let i = 1; i < N; i++) {
          const l = L[i], r = R[i - 1], P = k1[i] * r + k2[i] * l;
          jR[i] = P - l; jL[i] = P - r;
        }
      } else {
        const ns = this.ns, A = this.A, nR = this.nR, nL = this.nL, njR = this.njR, njL = this.njL, NL = this.NL;
        for (let i = 1; i < ns; i++) {
          const l = L[i], r = R[i - 1], P = k1[i] * r + k2[i] * l;
          jR[i] = P - l; jL[i] = P - r;
        }
        {
          const l = L[ns], r = R[ns - 1], nl = nL[0], a1 = A[ns - 1], a2 = A[ns], a3 = this.nA[0];
          const P = 2 * (a1 * r + a2 * l + a3 * nl) / (a1 + a2 + a3);
          jR[ns] = P - l; jL[ns] = P - r; njR[0] = P - nl;
        }
        for (let i = ns + 1; i < N; i++) {
          const l = L[i], r = R[i - 1], P = k1[i] * r + k2[i] * l;
          jR[i] = P - l; jL[i] = P - r;
        }
        const nrN = nR[NL - 1];
        this.noseS += this.noseC * (nrN - this.noseS);
        const nrefl = -0.92 * this.noseS;
        njL[NL] = nrefl;
        out += 0.8 * (nrN + nrefl);
        const nk1 = this.nk1, nk2 = this.nk2;
        for (let j = 1; j < NL; j++) {
          const l = nL[j], r = nR[j - 1], P = nk1[j] * r + nk2[j] * l;
          njR[j] = P - l; njL[j] = P - r;
        }
        for (let j = 0; j < NL; j++) { nR[j] = njR[j] * loss; nL[j] = njL[j + 1] * loss; }
      }
      if (fn !== 0) { const q = this.inj; jR[q] += fn; jL[q] += fn; }
      for (let i = 0; i < N; i++) { R[i] = jR[i] * loss; L[i] = jL[i + 1] * loss; }
      return out;
    }
  }

  /* ---- LF glottal flow-derivative model (Fant Rd parametrisation) ---- */
  function lfSetup(Rd, o) {
    Rd = clamp(Rd, 0.5, 2.7);
    const Ra = -0.01 + 0.048 * Rd, Rk = 0.224 + 0.118 * Rd;
    const Rg = (Rk / 4) * (0.5 + 1.2 * Rk) / (0.11 * Rd - Ra * (0.5 + 1.2 * Rk));
    const Ta = Ra, Tp = 1 / (2 * Rg), Te = Tp + Tp * Rk;
    const eps = 1 / Ta, shift = Math.exp(-eps * (1 - Te)), Delta = 1 - shift;
    const omega = PI / Tp, s = Math.sin(omega * Te);
    // solve alpha so the net flow-derivative over one period is zero
    const ret = -1 / eps + shift * (1 - Te) / Delta;
    const open = (al) => -((al * s - omega * Math.cos(omega * Te)) + omega * Math.exp(-al * Te)) / (s * (al * al + omega * omega));
    let lo = -200, hi = 200;
    for (let k = 0; k < 40; k++) {
      const mid = 0.5 * (lo + hi);
      // open(alpha)+ret is increasing in alpha here; keep sign test generic
      const f = open(mid) + ret, flo = open(lo) + ret;
      if ((f > 0) === (flo > 0)) lo = mid; else hi = mid;
    }
    const alpha = 0.5 * (lo + hi);
    o.Te = Te; o.eps = eps; o.shift = shift; o.invDelta = 1 / Delta; o.omega = omega; o.alpha = alpha;
    o.E0 = -1 / (s * Math.exp(alpha * Te));
  }
  function lfWave(tn, o) {
    return tn > o.Te ? (o.shift - Math.exp(-o.eps * (tn - o.Te))) * o.invDelta
      : o.E0 * Math.exp(o.alpha * tn) * Math.sin(o.omega * tn);
  }
  // RMS of the waveform per Rd, for loudness normalisation
  const RMS_TAB = new Float64Array(24);
  (function () {
    const o = {};
    for (let k = 0; k < 24; k++) {
      lfSetup(0.5 + k * 0.1, o);
      let s = 0; const M = 2000;
      for (let i = 0; i < M; i++) { const g = lfWave(i / M, o); s += g * g; }
      RMS_TAB[k] = Math.sqrt(s / M);
    }
  })();
  const rmsAt = (Rd) => { const p = clamp((Rd - 0.5) * 10, 0, 22.999), i = Math.floor(p); return lerp(RMS_TAB[i], RMS_TAB[i + 1], p - i); };

  /* ---- one voice ---- */
  const TICK = 16;
  const ART = ['x', 'y', 'w', 'lips', 'phar', 'vel', 'tip', 'lc'];
  const mkArt = () => ({ x: 0.5, y: 0.5, w: 0.5, lips: 0.5, phar: 0.5, vel: 0, tip: 1, lc: 0 });
  const mkSeg = () => ({ x: 0.5, y: 0.5, w: 0.5, lips: 0.5, phar: 0.5, vel: 0, tip: 1, lc: 0, vo: 1, asp: 0, fr: 0, bu: 0, dur: 0, tt: 30, nuc: false, sy: 0 });
  const SEG_POOL = 24;

  /* control-rate ADSR with optional A-D loop, for env 2 and 3 */
  class ModEnv {
    constructor() { this.v = 0; this.st = 0; this.t = 0; }
    gateOn() { this.st = 1; this.t = 0; }
    gateOff() { if (this.st) this.st = 4; }
    step(dtms, a, d, s, r, loop) {
      switch (this.st) {
        case 1: this.v += dtms / Math.max(a, 0.5); if (this.v >= 1) { this.v = 1; this.st = 2; this.t = 0; } break;
        case 2: {
          this.t += dtms;
          this.v = s + (this.v - s) * Math.exp(-dtms / Math.max(d * 0.25, 0.3));
          if (this.t >= d) { if (loop) { this.st = 1; } else { this.st = 3; this.v = s; } }
          break;
        }
        case 3: this.v = s; break;
        case 4: this.v *= Math.exp(-dtms / Math.max(r * 0.2, 0.3)); if (this.v < 1e-4) { this.v = 0; this.st = 0; } break;
      }
      return this.v;
    }
  }

  function lfoShape(shape, ph, r0, r1) {
    switch (shape) {
      case 0: return Math.sin(TAU * ph);
      case 1: return ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph;
      case 2: return 2 * ph - 1;
      case 3: return ph < 0.5 ? 1 : -1;
      case 4: return r1;
      default: { const t = ph * ph * (3 - 2 * ph); return r0 + (r1 - r0) * t; }
    }
  }

  class Voice {
    constructor(syn, idx) {
      this.syn = syn; this.idx = idx;
      this.tract = new Tract(syn.maxN, syn.fsT);
      this.art = mkArt(); this.tg = mkArt();
      this.seed = (2463534242 + idx * 7919) | 0;
      this.active = false; this.gate = false; this.sustained = false; this.pendingRel = false;
      this.note = 60; this.vel = 0.8; this.ch = 0; this.env = 0; this.est = 0; this.age = 0; this.order = 0;
      this.o1 = 0; this.o2 = 0; this.gl = 0.7; this.gr = 0.7; this.pan0 = 0;
      this.f = 220; this.gn = 60; this.vibPh = 0; this.drift = 0; this.dT = 0; this.dCount = 0;
      this.t = 0; this.wlen = 1 / 220; this.invLen = 220; this.ten = 0.6; this.shim = 1; this.gGain = 1; this.aspGain = 0.1;
      this.fricAmt = 0; this.hp = 0; this.lpS = 0; this.burst = 0; this.vo = 1; this.asp = 0; this.fr = 0;
      this.Te = 0.6; this.eps = 1; this.shift = 0; this.invDelta = 1; this.omega = 1; this.alpha = 0; this.E0 = 1;
      this.aC = 0.001; this.dC = 0.001; this.rC = 0.999; this.vamp = 1; this.ampMod = 1;
      // modulation
      this.src = new Float64Array(NS); this.dst = new Float64Array(ND);
      this.e2 = new ModEnv(); this.e3 = new ModEnv();
      this.lph = [0, 0]; this.lr0 = [0, 0]; this.lr1 = [0, 0]; this.rand = 0; this.pat = 0;
      // phrase
      this.pool = []; for (let i = 0; i < SEG_POOL; i++) this.pool.push(mkSeg());
      this.ql = 0; this.qi = 0; this.segT = 0; this.sy = -1; this.nucT = 0; this.inPhrase = false; this.Leff = 17.5; this.firstSyl = true; this.closeF = 1;
      this.tmpA = mkArt(); this.tmpB = mkArt();
    }
    rnd() {
      let s = this.seed; s ^= s << 13; s ^= s >>> 17; s ^= s << 5; this.seed = s | 0;
      return (s >>> 0) / 2147483648 - 1;
    }
    start(note, vel, order, ch, sy) {
      const syn = this.syn, P = syn.p;
      const was = this.active;
      this.note = note; this.vel = vel; this.ch = ch || 0; this.gate = true; this.sustained = false; this.pendingRel = false; this.order = order;
      this.vamp = 0.3 + 0.7 * Math.pow(vel, 1.3);
      this.gn = (P.glideMode === 1 && syn.lastNote >= 0) ? syn.lastNote : note;
      this.age = 0; this.est = 1; this.pat = 0;
      this.rand = this.rnd();
      this.e2.gateOn(); this.e3.gateOn();
      if (P.l1retrig) { this.lph[0] = 0; this.lr0[0] = this.lr1[0]; this.lr1[0] = this.rnd(); }
      if (P.l2retrig) { this.lph[1] = 0; this.lr0[1] = this.lr1[1]; this.lr1[1] = this.rnd(); }
      this.setEnvTimes();
      this.pan0 = clamp(((note - 60) / 30) * P.spread * 0.8 + this.rnd() * P.spread * 0.35, -1, 1);
      // phrase
      this.inPhrase = sy >= 0 && syn.syl.length > 0;
      if (this.inPhrase) this.beginSyllable(sy, false);
      if (!was) {
        this.tract.reset(); this.env = 0; this.vibPh = (this.rnd() + 1) * PI; this.drift = 0; this.dT = 0; this.dCount = 0;
        this.ten = clamp(P.tension + (vel - 0.6) * 0.3, 0, 1);
        this.t = 0; this.hp = 0; this.lpS = 0; this.burst = 0;
        this.computeMods(0);
        this._targets();
        for (let k = 0; k < 8; k++) this.art[ART[k]] = this.tg[ART[k]];
        this.vo = this.inPhrase ? this.pool[0].vo : 1; this.asp = 0; this.fr = 0;
        this._shape();
        this.newPeriod();
      }
      this.active = true;
    }
    legato(note, vel, ch, sy, retrig) {
      const P = this.syn.p;
      this.note = note; this.vel = vel; if (ch !== undefined) this.ch = ch;
      this.vamp = 0.3 + 0.7 * Math.pow(vel, 1.3); this.gate = true; this.sustained = false; this.pendingRel = false;
      if (this.est === 3) this.est = 1;
      if (retrig && P.legRetrig) { this.e2.gateOn(); this.e3.gateOn(); }
      if (sy >= 0 && this.syn.syl.length) { this.firstSyl = true; if (this.inPhrase) this.advanceTo(sy); else { this.inPhrase = true; this.beginSyllable(sy, false); } }
    }
    release() {
      if (this.pendingRel) return;
      if (this.inPhrase && this.gate) {
        const n = this.queueCoda(0);
        if (n > 0) { this.ql = n; this.qi = 0; this.segT = 0; this.nucT = 0; this.pendingRel = true; return; }
      }
      this.reallyRelease();
    }
    reallyRelease() { this.pendingRel = false; this.gate = false; this.est = 3; this.e2.gateOff(); this.e3.gateOff(); this.setEnvTimes(); }
    finish() { this.active = false; this.gate = false; this.pendingRel = false; this.env = 0; this.est = 0; this.tract.reset(); this.inPhrase = false; }
    setEnvTimes() {
      const P = this.syn.p, sr = this.syn.sr;
      this.aC = 1 - Math.exp(-1 / (sr * Math.max(P.attack, 1) * 0.001 / 1.6));
      this.dC = 1 - Math.exp(-1 / (sr * Math.max(P.decay, 5) * 0.001 / 4));
      this.rC = Math.exp(-1 / (sr * Math.max(P.release, 5) * 0.001 / 5));
    }

    /* ---------- phrase sequencing ---------- */
    _fillVowel(seg, code, sy) {
      vowelShape(code, seg);
      seg.vo = 1; seg.asp = 0; seg.fr = 0; seg.bu = 0; seg.dur = 0; seg.tt = 45; seg.nuc = true; seg.sy = sy;
    }
    _fillCons(seg, code, base, sy) {
      const P = this.syn.p, c = CONS[code], s = clamp(P.phCons, 0, 1);
      for (let k = 0; k < 8; k++) seg[ART[k]] = base[ART[k]];
      const o = c.o;
      for (const k in o) seg[k] = lerp(base[k], o[k], 0.25 + 0.75 * s);
      seg.vo = lerp(1, c.vo, s); seg.asp = (c.asp || 0) * s; seg.fr = (c.fr || 0) * s; seg.bu = (c.bu || 0) * s;
      seg.dur = c.dur * (0.6 + 0.4 * s); seg.tt = c.tt; seg.nuc = false; seg.sy = sy;
    }
    _pushCons(n, code, base, sy) {
      if (AFFRIC[code]) { const pair = AFFRIC[code]; this._fillCons(this.pool[n], pair[0], base, sy); this.pool[n].dur *= 0.7; this.pool[n].bu *= 0.5; n++; code = pair[1]; }
      if (!CONS[code] || n >= SEG_POOL - 2) return n;
      this._fillCons(this.pool[n], code, base, sy); return n + 1;
    }
    _vowelBase(sy, which) {   // shape of the syllable's vowel (first part, or the off-glide)
      const S = this.syn.syl[sy], v = S.v;
      const code = DIPH[v] ? DIPH[v][which] : v;
      return vowelShape(VMAP[code] || VCUSTOM[code] ? code : 'AX', which ? this.tmpB : this.tmpA);
    }
    _onset(sy, n) {
      const S = this.syn.syl[sy];
      const base = this._vowelBase(sy, 0);
      for (let i = 0; i < S.on.length; i++) n = this._pushCons(n, S.on[i], base, sy);
      const v = DIPH[S.v] ? DIPH[S.v][0] : S.v;
      this._fillVowel(this.pool[n], VMAP[v] || VCUSTOM[v] ? v : 'AX', sy);
      return n + 1;
    }
    queueCoda(n) {   // the closing part of the current syllable, written at pool[n..]
      if (this.sy < 0 || this.sy >= this.syn.syl.length) return n;
      const S = this.syn.syl[this.sy];
      let base = this._vowelBase(this.sy, 0);
      if (DIPH[S.v]) {
        base = this._vowelBase(this.sy, 1);
        const g = this.pool[n]; this._fillVowel(g, DIPH[S.v][1], this.sy); g.nuc = false; g.dur = 150; g.tt = 70; n++;
      }
      for (let i = 0; i < S.off.length; i++) n = this._pushCons(n, S.off[i], base, this.sy);
      return n;
    }
    beginSyllable(sy, withCoda) {
      this.firstSyl = true;
      let n = withCoda ? this.queueCoda(0) : 0;
      n = this._onset(sy, n);
      this.ql = n; this.qi = 0; this.segT = 0; this.nucT = 0; this.sy = sy;
    }
    advanceTo(sy) {
      let n = this.queueCoda(0);
      n = this._onset(sy, n);
      this.ql = n; this.qi = 0; this.segT = 0; this.nucT = 0; this.sy = sy;
    }
    _syllableBudget(sy) {
      const S = this.syn.syl[sy]; let t = 0;
      for (const c of S.on) t += (CONS[c] ? CONS[c].dur : 100);
      for (const c of S.off) t += (CONS[c] ? CONS[c].dur : 100);
      if (DIPH[S.v]) t += 150;
      return Math.max(70, this.syn.p.phLen - t);
    }
    _phraseTick(dtms) {
      const syn = this.syn, P = syn.p;
      let seg = this.pool[this.qi];
      this.segT += dtms;
      if (seg.nuc) this.nucT += dtms;
      // finished a timed segment: move on (a nucleus holds until told otherwise)
      if (!seg.nuc && this.segT >= seg.dur) {
        if (seg.bu > 0) this.burst = Math.max(this.burst, seg.bu);
        if (this.qi < this.ql - 1) { this.qi++; this.segT = 0; seg = this.pool[this.qi]; }
        else if (this.pendingRel) { this.reallyRelease(); }
      }
      // keep singing through the phrase while the key is held
      const budget = this.firstSyl ? Math.max(this._syllableBudget(this.sy), P.phWait) : this._syllableBudget(this.sy);
      if (seg.nuc && this.gate && !this.pendingRel && P.phAuto && this.nucT >= budget) {
        this.firstSyl = false;
        let nx = this.sy + 1;
        if (nx >= syn.syl.length) nx = P.phLoop ? 0 : -1;
        if (nx >= 0) {
          this.advanceTo(nx);
          if (this.order === syn.order) syn.phPos = nx;
          seg = this.pool[0];
        }
      }
      return seg;
    }

    /* ---------- modulation ---------- */
    computeMods(dtms) {
      const syn = this.syn, P = syn.p, src = this.src, dst = this.dst;
      src[0] = this.e2.step(dtms, P.e2a, P.e2d, P.e2s, P.e2r, P.e2loop);
      src[1] = this.e3.step(dtms, P.e3a, P.e3d, P.e3s, P.e3r, P.e3loop);
      for (let L = 0; L < 2; L++) {
        const pre = L ? 'l2' : 'l1';
        const shape = P[pre + 'shape'];
        let val;
        if (P[pre + 'retrig']) {
          let rate = P[pre + 'sync'] ? (P.bpm / 60) / LFO_DIVS[clamp(P[pre + 'div'] | 0, 0, LFO_DIVS.length - 1)] : P[pre + 'rate'];
          rate *= Math.pow(2, dst[L ? 19 : 17] * 4);
          this.lph[L] += rate * dtms * 0.001;
          if (this.lph[L] >= 1) { this.lph[L] -= Math.floor(this.lph[L]); this.lr0[L] = this.lr1[L]; this.lr1[L] = this.rnd(); }
          val = lfoShape(shape, this.lph[L], this.lr0[L], this.lr1[L]);
        } else val = lfoShape(shape, syn.gph[L], syn.gr0[L], syn.gr1[L]);
        src[2 + L] = val * clamp(P[pre + 'amt'] + dst[L ? 20 : 18], 0, 1);
      }
      src[4] = this.vel;
      src[5] = clamp((this.note - 60) / 36, -1, 1);
      src[6] = syn.mw;
      const mpe = P.mpe && this.ch > 0;
      src[7] = Math.max(mpe ? syn.chPress[this.ch] : syn.press, this.pat);
      src[8] = mpe ? syn.chSlide[this.ch] : syn.slide;
      src[9] = mpe ? syn.chBend[this.ch] : syn.bend;
      src[10] = this.rand;
      dst.fill(0);
      const R = syn.routes, M = syn.mod;
      for (let i = 0; i < R.length; i++) { const r = R[i]; dst[r % ND] += src[(r / ND) | 0] * M[r]; }
    }
    _targets() {
      const P = this.syn.p, T = this.tg, d = this.dst;
      let seg = null;
      if (this.inPhrase && this.syn.syl.length) {
        seg = this.pool[this.qi];
        T.x = seg.x; T.y = seg.y; T.w = seg.w; T.lips = seg.lips; T.phar = seg.phar; T.vel = seg.vel; T.tip = seg.tip; T.lc = seg.lc;
      } else {
        const m = clamp(P.morph + d[16], 0, 1);
        T.x = lerp(P.x, P.bx, m); T.y = lerp(P.y, P.by, m); T.w = lerp(P.w, P.bw, m);
        T.lips = lerp(P.lips, P.blips, m); T.phar = lerp(P.phar, P.bphar, m); T.vel = lerp(P.vel, P.bvel, m); T.tip = P.tip; T.lc = 0;
      }
      // high notes: open the jaw so the first formant can follow the pitch
      if (!seg || seg.nuc) {
        const tn = P.tune * sstep(300, 900, this.f);
        if (tn > 0) { T.y += (1 - T.y) * 0.65 * tn; T.lips += (1 - T.lips) * 0.6 * tn; }
      }
      T.x = clamp(T.x + d[3], 0, 1); T.y = clamp(T.y + d[4], seg ? -1 : 0, 1); T.w = clamp(T.w + d[5], 0, 1);
      T.lips = clamp(T.lips + d[6], 0, 1); T.phar = clamp(T.phar + d[7], 0, 1); T.vel = clamp(T.vel + d[8], 0, 1);
      T.tip = clamp(T.tip + d[9], 0, 1);
      return seg;
    }
    _shape() {
      const syn = this.syn, P = syn.p, tr = this.tract, d = this.dst;
      const Leff = clamp(P.length + d[10] * 8 + clamp(P.larynx + d[11], -1, 1) * 1.2, 8, 26);
      this.Leff = Leff;
      const N = clamp(Math.round(Leff * syn.fsT / C), 20, syn.maxN - 1);
      tr.resize(N);
      const s = this.art;
      const info = buildAreas(s, N, tr.A);
      tr.setShape(s.vel * 2.2);
      const tight = clamp((0.55 - info.minA) / 0.5, 0, 1);
      const hiss = clamp(P.fric + d[14], 0, 1);
      this.fricAmt = hiss * tight * tight * 0.4 + this.fr * 0.45 * (0.25 + 0.75 * tight) + this.burst * 0.9;
      tr.inj = clamp(info.minI + 1, 2, N - 2);
      this.closeF = clamp(info.minA / 0.09, 0, 1);
    }
    tick() {
      const syn = this.syn, P = syn.p, dt = TICK / syn.sr, dtms = dt * 1000;
      this.age += dt;
      this.computeMods(dtms);
      const d = this.dst;
      // pitch: glide on the note number, bends, vibrato and drift
      const gl = P.glide > 1 ? 1 - Math.exp(-dt / (P.glide * 0.001)) : 1;
      this.gn += (this.note - this.gn) * gl;
      this.vibPh += TAU * P.vibRate * dt;
      if (this.vibPh > TAU) this.vibPh -= TAU;
      const vEnv = clamp((this.age * 1000 - P.vibDelay) / 400, 0, 1);
      if (--this.dCount <= 0) { this.dT = this.rnd() * P.human * 9; this.dCount = 400 + Math.floor((this.rnd() + 1) * 400); }
      this.drift += (this.dT - this.drift) * 0.004;
      const cents = Math.max(0, P.vib + d[15] * 60) * vEnv * Math.sin(this.vibPh) + this.drift;
      const nb = (P.mpe && this.ch > 0) ? syn.chBend[this.ch] * P.mpeBend : 0;
      this.f = clamp(440 * Math.pow(2, (this.gn - 69 + syn.bendSemis + nb + d[0] * 24) / 12 + cents / 1200), 20, 3000);
      // articulation: phrase segment or knobs, plus modulation
      const seg = this.inPhrase ? this._phraseTick(dtms) : null;
      this._targets();
      const tt = seg ? seg.tt : P.artTime;
      const ka = 1 - Math.exp(-dtms / (tt + 1));
      const s = this.art, T = this.tg;
      for (let k = 0; k < 8; k++) { const key = ART[k]; s[key] += (T[key] - s[key]) * ka; }
      const kf = 1 - Math.exp(-dtms / 6);
      this.vo += ((seg ? seg.vo : 1) - this.vo) * kf;
      this.asp += ((seg ? seg.asp : 0) - this.asp) * kf;
      this.fr += ((seg ? seg.fr : 0) - this.fr) * kf;
      this.burst *= Math.exp(-dtms / 7);
      this._shape();
      // source
      const tt2 = clamp(P.tension + (this.vel - 0.6) * 0.3 + d[12], 0, 1);
      this.ten += (tt2 - this.ten) * 0.05;
      this.aspGain = (clamp(P.breath + d[13], 0, 1) * (1.15 - 0.75 * this.ten) * 0.5 + this.asp * 0.6) * (0.12 + 0.88 * this.closeF) + this.burst * 0.25;
      this.ampMod = clamp(1 + d[1], 0, 2);
      const pan = clamp(this.pan0 + d[2], -1, 1);
      this.gl = Math.cos((pan + 1) * PI / 4); this.gr = Math.sin((pan + 1) * PI / 4);
    }
    newPeriod() {
      const syn = this.syn, P = syn.p;
      const f = this.f * (1 + this.rnd() * 0.005 * P.human);
      this.wlen = 1 / f; this.invLen = f;
      const Rd = clamp(3 * (1 - this.ten), 0.5, 2.7);
      lfSetup(Rd, this);
      this.shim = 1 + this.rnd() * 0.05 * P.human;
      this.gGain = 0.5 / rmsAt(Rd) * this.shim;
      this.tract.gRefl = 0.66 + 0.26 * this.ten;
    }
    sample() {
      const syn = this.syn;
      switch (this.est) {
        case 1: this.env += (1.25 - this.env) * this.aC; if (this.env >= 1) { this.env = 1; this.est = 2; } break;
        case 2: this.env += (syn.p.sustain - this.env) * this.dC; break;
        case 3: this.env *= this.rC; if (this.env < 4e-4) { this.finish(); this.o1 = 0; this.o2 = 0; return; } break;
      }
      const amp = this.env * this.vamp * this.ampMod;
      const tr = this.tract, dtT = syn.dtT;
      const fr = this.fricAmt * amp, hpC = syn.hpC, lpC = syn.lpC, gv = this.gGain * this.vo;
      for (let k = 0; k < 2; k++) {
        const tn = this.t * this.invLen;
        const open = tn < this.Te;
        const g = open ? this.E0 * Math.exp(this.alpha * tn) * Math.sin(this.omega * tn)
          : (this.shift - Math.exp(-this.eps * (tn - this.Te))) * this.invDelta;
        this.t += dtT;
        if (this.t >= this.wlen) { this.t -= this.wlen; this.newPeriod(); }
        const n = this.rnd();
        this.hp += hpC * (n - this.hp);
        this.lpS += lpC * ((n - this.hp) - this.lpS);
        const src = (g * gv + this.lpS * this.aspGain * (open || this.vo < 0.5 ? 1 : 0.35)) * amp;
        const o = tr.step(src, fr * n);
        if (k === 0) this.o1 = o; else this.o2 = o;
      }
    }
  }

  /* ---- halfband decimator (96k -> 48k) ---- */
  class Halfband {
    constructor() {
      const K = 15, taps = [], idx = [];
      let sum = 0;
      for (let j = 0; j <= 2 * K; j++) {
        const k = j - K;
        let h;
        if (k === 0) h = 0.5;
        else if (Math.abs(k) % 2 === 0) continue;
        else h = Math.sin(PI * k / 2) / (PI * k);
        const wv = 0.42 - 0.5 * Math.cos(TAU * (j + 0.5) / (2 * K + 1)) + 0.08 * Math.cos(2 * TAU * (j + 0.5) / (2 * K + 1));
        h *= wv; idx.push(j); taps.push(h); sum += h;
      }
      this.tc = Float64Array.from(taps.map(h => h / sum)); // unity DC gain
      this.tj = Int32Array.from(idx);
      this.buf = new Float64Array(64); this.pos = 0;
    }
    push2(a, b) {
      const buf = this.buf;
      buf[this.pos & 63] = a; this.pos++; buf[this.pos & 63] = b; this.pos++;
      let y = 0; const tc = this.tc, tj = this.tj, p = this.pos - 1;
      for (let i = 0; i < tc.length; i++) y += tc[i] * buf[(p - tj[i]) & 63];
      return y;
    }
  }

  /* ---- small stereo reverb ---- */
  class Reverb {
    constructor(sr) {
      const sc = sr / 44100;
      const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], aps = [556, 441, 341, 225];
      const mk = (n) => ({ b: new Float32Array(Math.max(8, Math.round(n * sc))), i: 0, s: 0 });
      this.cL = combs.map(mk); this.cR = combs.map(n => mk(n + 23));
      this.aL = aps.map(mk); this.aR = aps.map(n => mk(n + 23));
      this.fb = 0.82; this.damp = 0.28; this.wl = 0; this.wr = 0;
    }
    _ch(x, cs, as) {
      let o = 0; const fb = this.fb, d = this.damp;
      for (let k = 0; k < cs.length; k++) {
        const c = cs[k], y = c.b[c.i];
        c.s = y * (1 - d) + c.s * d;
        c.b[c.i] = x + c.s * fb;
        if (++c.i >= c.b.length) c.i = 0;
        o += y;
      }
      for (let k = 0; k < as.length; k++) {
        const a = as[k], y = a.b[a.i];
        const z = o - y;
        a.b[a.i] = o + y * 0.5; o = z;
        if (++a.i >= a.b.length) a.i = 0;
      }
      return o;
    }
    run(l, r) { const x = (l + r) * 0.015; this.wl = this._ch(x, this.cL, this.aL); this.wr = this._ch(x, this.cR, this.aR); }
  }

  /* ---- the instrument ---- */
  class Synth {
    constructor(sr, opts) {
      opts = opts || {};
      this.sr = sr;
      this.os = sr > 60000 ? 1 : 2;
      this.fsT = sr * this.os;
      this.dtT = 1 / this.fsT;
      this.maxN = Math.ceil(27 * this.fsT / C) + 4;
      this.p = Object.assign({}, DEFAULTS);
      this.mod = new Float32Array(NS * ND); this.routes = [];
      for (const [s, d, v] of DEFAULT_MODS) this.mod[SI[s] * ND + DI[d]] = v;
      this._routes();
      this.syl = []; this.phPos = -1; this.lastOnT = -1e9; this.lastSy = -1; this.idleT = 0; this.time = 0;
      this.nV = opts.maxVoices || 10;
      this.voices = []; for (let i = 0; i < this.nV; i++) this.voices.push(new Voice(this, i));
      this.hbL = new Halfband(); this.hbR = new Halfband();
      this.rev = new Reverb(sr);
      this.hpC = 1 - Math.exp(-TAU * 450 / this.fsT);
      this.lpC = 1 - Math.exp(-TAU * 4200 / this.fsT);
      this.bendSemis = 0; this.bend = 0; this.press = 0; this.slide = 0; this.mw = 0; this.sustainOn = false;
      this.chPress = new Float64Array(16); this.chSlide = new Float64Array(16); this.chBend = new Float64Array(16);
      this.gph = [0, 0]; this.gr0 = [0, 0]; this.gr1 = [0, 0]; this.gseed = 991;
      this.stack = []; this.order = 0; this.cc = 1; this.lastNote = -1;
      this.dcxL = 0; this.dcyL = 0; this.dcxR = 0; this.dcyR = 0; this.toneL = 0; this.toneR = 0;
      this.outGain = opts.outGain || 2.5;
      this.peak = 0;
      this._tone();
    }
    _routes() { const r = []; for (let i = 0; i < NS * ND; i++) if (this.mod[i] !== 0) r.push(i); this.routes = r; }
    setMod(s, d, v) {
      const si = typeof s === 'number' ? s : SI[s], di = typeof d === 'number' ? d : DI[d];
      if (si === undefined || di === undefined) return;
      this.mod[si * ND + di] = clamp(v, -1, 1); this._routes();
    }
    setMods(arr) { this.mod.fill(0); for (let i = 0; i < Math.min(arr.length, NS * ND); i++) this.mod[i] = clamp(+arr[i] || 0, -1, 1); this._routes(); }
    setPhrase(syl) {
      const ok = [];
      for (const s of syl || []) {
        const v = (VMAP[s.v] || VCUSTOM[s.v] || DIPH[s.v]) ? s.v : 'AX';
        ok.push({ on: (s.on || []).filter(c => CONS[c] || AFFRIC[c]), v, off: (s.off || []).filter(c => CONS[c] || AFFRIC[c]) });
      }
      this.syl = ok; this.phPos = -1;
      for (const vc of this.voices) if (vc.active) { vc.inPhrase = false; }
    }
    _grnd() { let s = this.gseed; s ^= s << 13; s ^= s >>> 17; s ^= s << 5; this.gseed = s | 0; return (s >>> 0) / 2147483648 - 1; }
    _tone() {
      const hi = this.sr * 0.45, fc = 700 * Math.pow(hi / 700, this.p.bright);
      this.toneC = 1 - Math.exp(-TAU * fc / this.sr);
    }
    setParam(k, v) {
      this.p[k] = v;
      if (k === 'bright') this._tone();
      if (k === 'bend') this.bendSemis = this.bend * v;
      if (k === 'voices') this._limitVoices();
      if (k === 'attack' || k === 'decay' || k === 'release') for (const vc of this.voices) if (vc.active) vc.setEnvTimes();
      if (k === 'mono' || k === 'mpe') this.allOff();
      if (k === 'phOn' && !v) for (const vc of this.voices) vc.inPhrase = false;
    }
    setParams(o) { for (const k in o) this.setParam(k, o[k]); }
    _limitVoices() {
      let n = 0;
      for (const vc of this.voices) if (vc.active && vc.gate && ++n > this.p.voices) vc.release();
    }
    setBend(v, ch) {
      if (this.p.mpe && ch > 0) { this.chBend[ch & 15] = v; return; }
      this.bend = v; this.bendSemis = v * this.p.bend;
    }
    setPressure(v, ch) { if (this.p.mpe && ch > 0) this.chPress[ch & 15] = v; else this.press = v; }
    setSlide(v, ch) { if (this.p.mpe && ch > 0) this.chSlide[ch & 15] = v; else this.slide = v; }
    polyAT(note, v) { for (const vc of this.voices) if (vc.active && vc.note === note) vc.pat = v; }
    /* which syllable a new note sings: next one, unless it is part of the same chord */
    _nextSyllable() {
      if (!this.p.phOn || !this.syl.length) return -1;
      if (this.time - this.lastOnT < 0.03 && this.lastSy >= 0) { this.lastOnT = this.time; return this.lastSy; }
      let nx = this.phPos + 1;
      if (nx >= this.syl.length) nx = this.p.phLoop ? 0 : this.syl.length - 1;
      this.phPos = nx; this.lastSy = nx; this.lastOnT = this.time;
      return nx;
    }
    _monoTarget() {
      const st = this.stack; if (!st.length) return null;
      if (this.p.prio === 1) { let b = st[0]; for (const e of st) if (e.n < b.n) b = e; return b; }
      if (this.p.prio === 2) { let b = st[0]; for (const e of st) if (e.n > b.n) b = e; return b; }
      return st[st.length - 1];
    }
    noteOn(note, vel, ch) {
      vel = clamp(vel, 0.02, 1); ch = ch | 0;
      this.order++;
      if (this.p.mono) {
        this.stack = this.stack.filter(e => e.n !== note); this.stack.push({ n: note, v: vel, ch });
        const vc = this.voices[0], tgt = this._monoTarget();
        if (vc.active && vc.gate && !vc.pendingRel) {
          if (tgt.n !== vc.note || tgt.n === note) { vc.order = this.order; vc.legato(tgt.n, tgt.v, tgt.ch, tgt.n === note ? this._nextSyllable() : -1, true); }
        } else vc.start(tgt.n, tgt.v, this.order, tgt.ch, this._nextSyllable());
        this.lastNote = note;
        return;
      }
      const sy = this._nextSyllable();
      const lim = Math.min(this.p.voices, this.nV);
      let pick = null;
      for (let i = 0; i < lim; i++) { const vc = this.voices[i]; if (vc.active && vc.note === note && !vc.gate) { pick = vc; break; } }
      if (!pick) for (let i = 0; i < lim; i++) if (!this.voices[i].active) { pick = this.voices[i]; break; }
      if (!pick) {
        let best = Infinity;
        for (let i = 0; i < lim; i++) { const vc = this.voices[i]; const sc = (vc.gate ? 10 : 0) + vc.env + vc.order * 1e-9; if (sc < best) { best = sc; pick = vc; } }
      }
      pick.active = false; pick.start(note, vel, this.order, ch, sy);
      this.lastNote = note;
    }
    noteOff(note, ch) {
      ch = ch | 0;
      const chOk = (vc) => !this.p.mpe || vc.ch === ch;
      if (this.p.mono) {
        this.stack = this.stack.filter(e => !(e.n === note && (!this.p.mpe || e.ch === ch)));
        const vc = this.voices[0];
        const tgt = this._monoTarget();
        if (tgt) { if (tgt.n !== vc.note) vc.legato(tgt.n, tgt.v, tgt.ch, -1, false); }
        else if (this.sustainOn) vc.sustained = true; else vc.release();
        return;
      }
      for (const vc of this.voices) if (vc.active && vc.gate && !vc.pendingRel && vc.note === note && chOk(vc) && !vc.sustained) { if (this.sustainOn) vc.sustained = true; else vc.release(); }
    }
    sustain(on) {
      this.sustainOn = on;
      if (!on) for (const vc of this.voices) if (vc.active && vc.sustained) { vc.sustained = false; vc.release(); }
    }
    allOff() { this.stack = []; this.sustainOn = false; for (const vc of this.voices) if (vc.active) { vc.sustained = false; vc.pendingRel = false; vc.reallyRelease(); } }
    activeCount() { let n = 0; for (const vc of this.voices) if (vc.active) n++; return n; }
    /* state of the newest sounding voice, for the display: [8 art, length, syllable, phrase pos, 11 sources] */
    telemetry(out) {
      let best = null;
      for (const vc of this.voices) if (vc.active && (!best || vc.order > best.order)) best = vc;
      if (!best) { out[0] = -1; return out; }
      for (let k = 0; k < 8; k++) out[k] = best.art[ART[k]];
      out[8] = best.Leff || this.p.length; out[9] = best.inPhrase ? best.sy : -1; out[10] = this.phPos;
      for (let i = 0; i < NS; i++) out[11 + i] = best.src[i];
      return out;
    }
    _globalTick(dt) {
      const P = this.p;
      for (let L = 0; L < 2; L++) {
        const pre = L ? 'l2' : 'l1';
        const rate = P[pre + 'sync'] ? (P.bpm / 60) / LFO_DIVS[clamp(P[pre + 'div'] | 0, 0, LFO_DIVS.length - 1)] : P[pre + 'rate'];
        this.gph[L] += rate * dt;
        if (this.gph[L] >= 1) { this.gph[L] -= Math.floor(this.gph[L]); this.gr0[L] = this.gr1[L]; this.gr1[L] = this._grnd(); }
      }
      this.time += dt;
      let gated = false;
      for (const vc of this.voices) if (vc.active && vc.gate) { gated = true; break; }
      if (gated) this.idleT = 0; else { this.idleT += dt; if (this.idleT > P.phReset && this.phPos >= 0) this.phPos = -1; }
    }
    render(outL, outR, n) {
      const P = this.p, voices = this.voices, nV = this.nV;
      const master = P.master * P.master * this.outGain * 2, room = P.room;
      let pk = 0;
      for (let s = 0; s < n; s++) {
        if (--this.cc <= 0) {
          this.cc = TICK; this._globalTick(TICK / this.sr);
          for (let v = 0; v < nV; v++) if (voices[v].active) voices[v].tick();
        }
        let a1L = 0, a1R = 0, a2L = 0, a2R = 0;
        for (let v = 0; v < nV; v++) {
          const vc = voices[v];
          if (!vc.active) continue;
          vc.sample();
          a1L += vc.o1 * vc.gl; a1R += vc.o1 * vc.gr; a2L += vc.o2 * vc.gl; a2R += vc.o2 * vc.gr;
        }
        let l, r;
        if (this.os === 2) { l = this.hbL.push2(a1L, a2L); r = this.hbR.push2(a1R, a2R); }
        else { l = a1L; r = a1R; }
        let y = l - this.dcxL + 0.995 * this.dcyL; this.dcxL = l; this.dcyL = y;
        this.toneL += this.toneC * (y - this.toneL); l = this.toneL;
        y = r - this.dcxR + 0.995 * this.dcyR; this.dcxR = r; this.dcyR = y;
        this.toneR += this.toneC * (y - this.toneR); r = this.toneR;
        l *= master; r *= master;
        if (room > 0.001) { this.rev.run(l, r); l += this.rev.wl * room * 3; r += this.rev.wr * room * 3; }
        l = Math.tanh(l); r = Math.tanh(r);
        outL[s] = l; outR[s] = r;
        const m = l < 0 ? -l : l; if (m > pk) pk = m;
      }
      this.peak = pk;
    }
    handle(m) {
      switch (m.t) {
        case 'p': this.setParam(m.k, m.v); break;
        case 'ps': this.setParams(m.o); break;
        case 'on': this.noteOn(m.n, m.v, m.ch); break;
        case 'off': this.noteOff(m.n, m.ch); break;
        case 'bend': this.setBend(m.v, m.ch | 0); break;
        case 'sus': this.sustain(!!m.v); break;
        case 'press': this.setPressure(m.v, m.ch | 0); break;
        case 'slide': this.setSlide(m.v, m.ch | 0); break;
        case 'pat': this.polyAT(m.n, m.v); break;
        case 'mw': this.mw = m.v; break;
        case 'mod': this.setMod(m.s, m.d, m.v); break;
        case 'mods': this.setMods(m.a); break;
        case 'phrase': this.setPhrase(m.s); break;
        case 'phReset': this.phPos = -1; break;
        case 'panic': this.allOff(); break;
      }
    }
  }

  /* ---- analysis helpers (used by the UI and the tuner) ---- */
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -TAU / len, wr = Math.cos(ang), wi = Math.sin(ang), half = len >> 1;
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < half; k++) {
          const a = i + k, b = a + half;
          const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
          const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
  }
  /* impulse response of the tract alone: returns {df, mag[]} (magnitude, linear) */
  function tractResponse(art, Lcm, sr, opts) {
    opts = opts || {};
    const os = sr > 60000 ? 1 : 2, fsT = sr * os;
    const N = clamp(Math.round(Lcm * fsT / C), 16, 200);
    const tr = new Tract(N + 4, fsT);
    if (opts.loss) tr.loss = opts.loss;
    if (opts.ideal) { tr.lipG = 1; tr.gRefl = 1; }
    tr.resize(N);
    buildAreas(art, N, tr.A);
    tr.setShape((art.vel || 0) * 2.2);
    if (opts.ideal) tr.lipC = 1;
    const M = opts.len || 3072, nfft = opts.nfft || 8192;
    const re = new Float64Array(nfft), im = new Float64Array(nfft);
    for (let i = 0; i < M; i++) {
      const w = 0.5 + 0.5 * Math.cos(PI * i / M);
      re[i] = tr.step(i === 0 ? 1 : 0, 0) * w;
    }
    fft(re, im);
    const half = nfft / 2, mag = new Float64Array(half);
    for (let i = 0; i < half; i++) mag[i] = Math.hypot(re[i], im[i]);
    return { df: fsT / nfft, mag, N, fsT };
  }
  function findFormants(resp, count, fmin, fmax) {
    const { df, mag } = resp, out = [];
    const i0 = Math.max(2, Math.floor((fmin || 120) / df)), i1 = Math.min(mag.length - 2, Math.floor((fmax || 5500) / df));
    for (let i = i0; i < i1 && out.length < count; i++) {
      const a = mag[i - 1], b = mag[i], c = mag[i + 1];
      if (b > a && b >= c && b > 0) {
        const la = Math.log(a + 1e-12), lb = Math.log(b), lc = Math.log(c + 1e-12);
        const d = 0.5 * (la - lc) / (la - 2 * lb + lc);
        out.push({ f: (i + d) * df, a: b });
      }
    }
    return out;
  }
  /* vowel chart: u = 0 front .. 1 back, v = 0 close .. 1 open */
  const padF1 = (v) => 280 + 460 * v, padF2lo = (v) => 1000 - 250 * v, padF2hi = (v) => 2250 - 750 * v;
  const padF2 = (u, v) => padF2lo(v) + (padF2hi(v) - padF2lo(v)) * (1 - u);
  function padArt(u, v, out) {
    out = out || {};
    const NU = GRID.NU, NV = GRID.NV;
    const fi = clamp(u, 0, 1) * (NU - 1), fj = clamp(v, 0, 1) * (NV - 1);
    const i0 = Math.min(NU - 2, Math.floor(fi)), j0 = Math.min(NV - 2, Math.floor(fj)), a = fi - i0, b = fj - j0;
    const keys = ['x', 'y', 'w', 'lips', 'phar'];
    for (let k = 0; k < 5; k++) {
      const c = (j, i) => GRID.d[(j * NU + i) * 5 + k];
      out[keys[k]] = lerp(lerp(c(j0, i0), c(j0, i0 + 1), a), lerp(c(j0 + 1, i0), c(j0 + 1, i0 + 1), a), b);
    }
    out.vel = 0;
    return out;
  }
  function vowelArt(name) { return VOWELS[name] || { x: 0.5, y: 0.6, w: 0.5, lips: 0.5, phar: 0.5, vel: 0 }; }

  return { MOD_SRC, MOD_DST, DST_SCALE, LFO_DIV_NAMES, LFO_DIVS, DEFAULT_MODS, CONS, VMAP, VCUSTOM, DIPH, AFFRIC, NS, ND, SI, DI, padArt, padF1, padF2, padF2lo, padF2hi, GRID, Synth, Tract, Voice, Halfband, buildAreas, tractResponse, findFormants, fft, lfSetup, lfWave, rmsAt, VOWELS, VOWEL_ORDER, VOWEL_FORMANTS, DEFAULTS, vowelArt, C, TICK };
}
if (typeof module !== 'undefined') module.exports = EngineFactory;
