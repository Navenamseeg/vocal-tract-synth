// Vocal Tract Synth engine: Kelly-Lochbaum waveguide tract + LF glottal source.
// Line-for-line port of the browser engine (engine.js). No allocation in render().
#pragma once
#include <array>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <string>
#include <vector>

namespace vts {

constexpr double PI = 3.14159265358979323846, TAU = PI * 2, C = 34300.0;
inline double clamp(double x, double a, double b) { return x < a ? a : x > b ? b : x; }
inline double lerp(double a, double b, double t) { return a + (b - a) * t; }
inline double sstep(double a, double b, double x) { double t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

// ---------------------------------------------------------------- parameters
// id, default, min, max, kind (0 continuous, 1 toggle, 2 integer)
#define VTS_PARAMS(X) \
  X(x, 0.5, 0, 1, 0) X(y, 0.5, 0, 1, 0) X(w, 0.5, 0, 1, 0) X(lips, 0.5, 0, 1, 0) X(phar, 0.5, 0, 1, 0) X(vel, 0, 0, 1, 0) X(tip, 1, 0, 1, 0) \
  X(morph, 0, 0, 1, 0) X(bx, 0.688, 0, 1, 0) X(by, 0.166, 0, 1, 0) X(bw, 0.735, 0, 1, 0) X(blips, 1, 0, 1, 0) X(bphar, 0.481, 0, 1, 0) X(bvel, 0, 0, 1, 0) \
  X(tension, 0.6, 0, 1, 0) X(breath, 0.12, 0, 1, 0) X(fric, 0, 0, 1, 0) X(vib, 22, 0, 80, 0) X(vibRate, 5.4, 2, 9, 0) X(vibDelay, 350, 0, 1500, 0) X(human, 0.35, 0, 1, 0) \
  X(length, 17.5, 10, 24, 0) X(larynx, 0, -1, 1, 0) X(tune, 0.5, 0, 1, 0) \
  X(attack, 25, 1, 5000, 0) X(decay, 400, 5, 8000, 0) X(sustain, 1, 0, 1, 0) X(release, 170, 5, 8000, 0) \
  X(e2a, 5, 1, 5000, 0) X(e2d, 220, 5, 8000, 0) X(e2s, 0, 0, 1, 0) X(e2r, 200, 5, 8000, 0) X(e2loop, 0, 0, 1, 1) \
  X(e3a, 400, 1, 5000, 0) X(e3d, 800, 5, 8000, 0) X(e3s, 0.6, 0, 1, 0) X(e3r, 500, 5, 8000, 0) X(e3loop, 0, 0, 1, 1) \
  X(l1shape, 0, 0, 5, 2) X(l1rate, 3, 0.05, 30, 0) X(l1sync, 0, 0, 1, 1) X(l1div, 4, 0, 9, 2) X(l1amt, 1, 0, 1, 0) X(l1retrig, 1, 0, 1, 1) \
  X(l2shape, 5, 0, 5, 2) X(l2rate, 0.6, 0.05, 30, 0) X(l2sync, 0, 0, 1, 1) X(l2div, 2, 0, 9, 2) X(l2amt, 1, 0, 1, 0) X(l2retrig, 0, 0, 1, 1) \
  X(bpm, 120, 40, 240, 0) \
  X(mono, 0, 0, 1, 1) X(legRetrig, 0, 0, 1, 1) X(glideMode, 0, 0, 1, 2) X(prio, 0, 0, 2, 2) X(glide, 90, 0, 1500, 0) X(bend, 2, 0, 24, 2) \
  X(mpe, 0, 0, 1, 1) X(mpeBend, 48, 1, 96, 2) X(voices, 6, 1, 10, 2) X(artTime, 30, 3, 400, 0) X(spread, 0.5, 0, 1, 0) \
  X(phOn, 0, 0, 1, 1) X(phAuto, 1, 0, 1, 1) X(phWait, 650, 100, 3000, 0) X(phLen, 380, 120, 2000, 0) X(phLoop, 1, 0, 1, 1) X(phReset, 2.5, 0.3, 15, 0) X(phCons, 0.85, 0, 1, 0) \
  X(master, 0.75, 0, 1, 0) X(room, 0.18, 0, 1, 0) X(bright, 0.85, 0, 1, 0)

enum ParamId {
#define X(id, d, a, b, k) P_##id,
  VTS_PARAMS(X)
#undef X
  NP
};
struct ParamInfo { const char* id; double def, mn, mx; int kind; };
inline const ParamInfo* paramInfo() {
  static const ParamInfo t[NP] = {
#define X(id, d, a, b, k) { #id, d, a, b, k },
    VTS_PARAMS(X)
#undef X
  };
  return t;
}
inline int paramIndex(const std::string& s) { const ParamInfo* t = paramInfo(); for (int i = 0; i < NP; i++) if (s == t[i].id) return i; return -1; }

// ---------------------------------------------------------------- modulation matrix
enum Src { S_ENV2, S_ENV3, S_LFO1, S_LFO2, S_VEL, S_NOTE, S_MW, S_PRESS, S_SLIDE, S_BEND, S_RAND, NS };
enum Dst { D_PITCH, D_AMP, D_PAN, D_X, D_Y, D_W, D_LIPS, D_PHAR, D_VEL, D_TIP, D_LENGTH, D_LARYNX, D_TENSION, D_BREATH, D_FRIC, D_VIB, D_MORPH, D_L1RATE, D_L1AMT, D_L2RATE, D_L2AMT, ND };
inline const char* srcName(int i) { static const char* n[NS] = { "env2", "env3", "lfo1", "lfo2", "vel", "note", "mw", "press", "slide", "bend", "rand" }; return n[i]; }
inline const char* dstName(int i) { static const char* n[ND] = { "pitch", "amp", "pan", "x", "y", "w", "lips", "phar", "vel", "tip", "length", "larynx", "tension", "breath", "fric", "vib", "morph", "l1rate", "l1amt", "l2rate", "l2amt" }; return n[i]; }
static const double LFO_DIVS[10] = { 16, 8, 4, 2, 1, 0.5, 0.25, 2.0 / 3, 1.0 / 3, 1.0 / 6 };

// ---------------------------------------------------------------- vowels and phonemes
struct Shape { double x, y, w, lips, phar; };
// order: i ɪ ɛ æ ɑ ɔ ʊ u ʌ ə
static const Shape VOWELS[10] = {
  { 0.688, 0.166, 0.735, 1, 0.481 }, { 0.588, 0.31, 0.571, 0.954, 0.38 }, { 0.628, 0.516, 0.45, 1, 0.144 }, { 0.594, 0.657, 0.318, 1, 0 },
  { 0.164, 0.304, 0.562, 0.76, 0.072 }, { 0.176, 0.121, 0.449, 0.443, 0.253 }, { 0.195, 0.326, 0.081, 0.32, 0.352 }, { 0.53, 0.033, 0, 0.087, 0.221 },
  { 0.191, 0.478, 0.489, 0.684, 0.216 }, { 0.542, 0.562, 0.47, 0.741, 0.354 } };
// ARPAbet vowels
enum Vow { AA, AE, AH, AX, AO, EH, IH, IY, UH, UW, ER, AW, AY, EY, OW, OY, NVOW };
static const char* VOW_NAMES[NVOW] = { "AA", "AE", "AH", "AX", "AO", "EH", "IH", "IY", "UH", "UW", "ER", "AW", "AY", "EY", "OW", "OY" };
static const int VMAP[10] = { 4, 3, 8, 9, 5, 2, 1, 0, 6, 7 };   // AA..UW -> VOWELS index
static const int DIPH[NVOW][2] = { {-1,-1},{-1,-1},{-1,-1},{-1,-1},{-1,-1},{-1,-1},{-1,-1},{-1,-1},{-1,-1},{-1,-1},{-1,-1},
  { AA, UH }, { AA, IY }, { EH, IY }, { AO, UH }, { AO, IY } };
// consonants
enum Con { P_, B_, M_, F_, V_, TH_, DH_, T_, D_, N_, S_, Z_, SH_, ZH_, K_, G_, NG_, L_, R_, W_, Y_, HH_, CH_, JH_, NCON };
static const char* CON_NAMES[NCON] = { "P", "B", "M", "F", "V", "TH", "DH", "T", "D", "N", "S", "Z", "SH", "ZH", "K", "G", "NG", "L", "R", "W", "Y", "HH", "CH", "JH" };
// art override slots: x y w lips phar vel tip lc ; NAN = keep the vowel's value
struct ConSpec { double o[8]; double vo, fr, asp, bu, dur, tt; };
#define _N NAN
static const ConSpec CONS[22] = {
  /*P */ { { _N, _N, _N, _N, _N, _N, _N, 1 }, 0, 0, 0, 1, 75, 10 },
  /*B */ { { _N, _N, _N, _N, _N, _N, _N, 1 }, 0.45, 0, 0, 0.5, 60, 10 },
  /*M */ { { _N, _N, _N, _N, _N, 1, _N, 1 }, 1, 0, 0, 0, 85, 14 },
  /*F */ { { _N, _N, _N, _N, _N, _N, _N, 0.8 }, 0, 0.75, 0, 0, 105, 16 },
  /*V */ { { _N, _N, _N, _N, _N, _N, _N, 0.8 }, 1, 0.35, 0, 0, 80, 16 },
  /*TH*/ { { _N, _N, _N, _N, _N, _N, 0.12, _N }, 0, 0.5, 0, 0, 100, 16 },
  /*DH*/ { { _N, _N, _N, _N, _N, _N, 0.14, _N }, 1, 0.2, 0, 0, 55, 16 },
  /*T */ { { _N, _N, _N, _N, _N, _N, 0, _N }, 0, 0, 0, 1, 60, 9 },
  /*D */ { { _N, _N, _N, _N, _N, _N, 0, _N }, 0.45, 0, 0, 0.55, 50, 9 },
  /*N */ { { _N, _N, _N, _N, _N, 1, 0, _N }, 1, 0, 0, 0, 80, 14 },
  /*S */ { { _N, _N, _N, _N, _N, _N, 0.07, _N }, 0, 1, 0, 0, 120, 14 },
  /*Z */ { { _N, _N, _N, _N, _N, _N, 0.07, _N }, 1, 0.5, 0, 0, 95, 14 },
  /*SH*/ { { 0.84, 0.05, _N, 0.25, _N, _N, _N, _N }, 0, 0.9, 0, 0, 120, 16 },
  /*ZH*/ { { 0.84, 0.05, _N, 0.25, _N, _N, _N, _N }, 1, 0.45, 0, 0, 95, 16 },
  /*K */ { { 0.6, -1, _N, _N, _N, _N, _N, _N }, 0, 0, 0, 1, 65, 10 },
  /*G */ { { 0.6, -1, _N, _N, _N, _N, _N, _N }, 0.45, 0, 0, 0.55, 55, 10 },
  /*NG*/ { { 0.6, -1, _N, _N, _N, 1, _N, _N }, 1, 0, 0, 0, 90, 14 },
  /*L */ { { _N, _N, 0.85, _N, _N, _N, 0.16, _N }, 1, 0, 0, 0, 70, 24 },
  /*R */ { { 0.62, 0.28, _N, 0.3, 0.1, _N, _N, _N }, 1, 0, 0, 0, 70, 30 },
  /*W */ { { 0.28, 0.14, 0.1, 0, _N, _N, _N, _N }, 1, 0, 0, 0, 65, 32 },
  /*Y */ { { 0.82, 0.04, _N, 1, _N, _N, _N, _N }, 1, 0, 0, 0, 55, 30 },
  /*HH*/ { { _N, _N, _N, _N, _N, _N, _N, _N }, 0, 0, 1, 0, 70, 20 } };
#undef _N
inline int vowCode(const std::string& s) { for (int i = 0; i < NVOW; i++) if (s == VOW_NAMES[i]) return i; return -1; }
inline int conCode(const std::string& s) { for (int i = 0; i < NCON; i++) if (s == CON_NAMES[i]) return i; return -1; }

struct Art { double x = 0.5, y = 0.5, w = 0.5, lips = 0.5, phar = 0.5, vel = 0, tip = 1, lc = 0;
  double& at(int k) { switch (k) { case 0: return x; case 1: return y; case 2: return w; case 3: return lips; case 4: return phar; case 5: return vel; case 6: return tip; default: return lc; } } };
inline void vowelShape(int code, Art& out) {
  if (code == ER) { out.x = 0.62; out.y = 0.3; out.w = 0.45; out.lips = 0.38; out.phar = 0.1; }
  else { const Shape& s = VOWELS[(code >= 0 && code <= UW) ? VMAP[code] : 9]; out.x = s.x; out.y = s.y; out.w = s.w; out.lips = s.lips; out.phar = s.phar; }
  out.vel = 0; out.tip = 1; out.lc = 0;
}

// ---------------------------------------------------------------- area function
struct AInfo { double xc, sig, c, minA; int minI; };
inline AInfo buildAreas(const Art& a, int N, double* A) {
  const double xc = 0.16 + 0.76 * a.x, sig = 0.05 + 0.2 * a.w, y = a.y;
  const double c = y >= 0 ? 0.025 + 0.975 * y * y : 0.025 * (1 + std::max(y, -1.0));
  const double ph = 0.55 + 1.1 * a.phar, lipA = 0.35 * std::pow(26.0, a.lips);
  const double aL = 1.1 * std::sqrt(ph), aP = 4.2 * ph, aO = 3.8 + 2.4 * clamp(y, 0, 1);
  const double lipS0 = 0.86 - 0.12 * (1 - a.lips);
  const double tip = clamp(a.tip, 0, 1), ct = tip * tip, lc = clamp(a.lc, 0, 1);
  const double inv2s = 1 / (2 * sig * sig), inv2t = 1 / (2 * 0.032 * 0.032);
  double minA = 99; int minI = 0;
  for (int i = 0; i < N; i++) {
    const double x = (i + 0.5) / N;
    double ar = lerp(aL, aP, sstep(0.07, 0.15, x));
    ar = lerp(ar, aO, sstep(0.38, 0.5, x));
    ar = lerp(ar, lipA, sstep(lipS0, 0.97, x));
    const double d = x - xc;
    ar *= 1 - std::exp(-d * d * inv2s) * (1 - c);
    if (ct < 1) { const double dt = x - 0.885; ar *= 1 - std::exp(-dt * dt * inv2t) * (1 - ct); }
    if (lc > 0) ar *= 1 - sstep(0.93, 0.985, x) * lc;
    if (ar < 0.012) ar = 0.012;
    A[i] = ar;
    if (i > 2 && ar < minA) { minA = ar; minI = i; }
  }
  return { xc, sig, c, minA, minI };
}

// ---------------------------------------------------------------- waveguide
constexpr int MAXN = 160;
struct Tract {
  double fsT = 96000;
  double R[MAXN + 3] {}, L[MAXN + 3] {}, jR[MAXN + 3] {}, jL[MAXN + 3] {}, A[MAXN + 3] {}, k1[MAXN + 3] {}, k2[MAXN + 3] {}, tmp[MAXN + 3] {};
  double nR[MAXN + 3] {}, nL[MAXN + 3] {}, njR[MAXN + 3] {}, njL[MAXN + 3] {}, nA[MAXN + 3] {}, nk1[MAXN + 3] {}, nk2[MAXN + 3] {};
  int N = 0, NL = 0, ns = 2, inj = 2; bool noseOn = false;
  double loss = 0.9994, gRefl = 0.75, lipC = 0.3, lipG = 0.96, lipS = 0, noseC = 0.25, noseS = 0;
  void reset() {
    std::memset(R, 0, sizeof R); std::memset(L, 0, sizeof L); std::memset(jR, 0, sizeof jR); std::memset(jL, 0, sizeof jL);
    std::memset(nR, 0, sizeof nR); std::memset(nL, 0, sizeof nL); std::memset(njR, 0, sizeof njR); std::memset(njL, 0, sizeof njL);
    lipS = 0; noseS = 0;
  }
  void resample(double* arr, int oldN, int n) {
    for (int i = 0; i < n; i++) {
      const double p = (i + 0.5) * oldN / n - 0.5; const int i0 = (int) std::floor(p); const double fr = p - i0;
      const double a = arr[(int) clamp(i0, 0, oldN - 1)], b = arr[(int) clamp(i0 + 1, 0, oldN - 1)];
      tmp[i] = a + (b - a) * fr;
    }
    for (int i = 0; i < n; i++) arr[i] = tmp[i];
    for (int i = n; i < oldN; i++) arr[i] = 0;
  }
  void resize(int n) {
    if (n == N) return;
    const int oldN = N, oldNL = NL;
    if (oldN > 0) { resample(R, oldN, n); resample(L, oldN, n); }
    N = n; NL = std::max(8, (int) std::lround(0.62 * n)); ns = (int) clamp((double) std::lround(0.4 * n), 2, n - 3);
    if (oldNL > 0 && oldNL != NL) { resample(nR, oldNL, NL); resample(nL, oldNL, NL); }
    for (int j = 1; j < NL; j++) nA[j] = 0.9 + 2.6 * std::pow(std::sin(PI * (j + 0.5) / NL), 0.6);
    for (int j = 2; j < NL; j++) { const double s = nA[j - 1] + nA[j]; nk1[j] = 2 * nA[j - 1] / s; nk2[j] = 2 * nA[j] / s; }
  }
  void setShape(double port) {
    for (int i = 1; i < N; i++) { const double s = A[i - 1] + A[i]; k1[i] = 2 * A[i - 1] / s; k2[i] = 2 * A[i] / s; }
    const double rad = std::sqrt(A[N - 1] / PI);
    const double fc = clamp(0.62 * C / (TAU * rad), 1800, 14000);
    lipC = 1 - std::exp(-TAU * fc / fsT);
    const bool on = port > 0.03;
    if (on) { nA[0] = port; const double s = port + nA[1]; nk1[1] = 2 * port / s; nk2[1] = 2 * nA[1] / s; }
    else if (noseOn) { std::memset(nR, 0, sizeof nR); std::memset(nL, 0, sizeof nL); std::memset(njR, 0, sizeof njR); std::memset(njL, 0, sizeof njL); noseS = 0; }
    noseOn = on;
  }
  inline double step(double src, double fn) {
    jR[0] = L[0] * gRefl + src;
    const double rN = R[N - 1];
    lipS += lipC * (rN - lipS);
    const double refl = -lipG * lipS;
    jL[N] = refl;
    double out = rN + refl;
    if (!noseOn) {
      for (int i = 1; i < N; i++) { const double l = L[i], r = R[i - 1], P = k1[i] * r + k2[i] * l; jR[i] = P - l; jL[i] = P - r; }
    } else {
      for (int i = 1; i < ns; i++) { const double l = L[i], r = R[i - 1], P = k1[i] * r + k2[i] * l; jR[i] = P - l; jL[i] = P - r; }
      { const double l = L[ns], r = R[ns - 1], nl = nL[0], a1 = A[ns - 1], a2 = A[ns], a3 = nA[0];
        const double P = 2 * (a1 * r + a2 * l + a3 * nl) / (a1 + a2 + a3); jR[ns] = P - l; jL[ns] = P - r; njR[0] = P - nl; }
      for (int i = ns + 1; i < N; i++) { const double l = L[i], r = R[i - 1], P = k1[i] * r + k2[i] * l; jR[i] = P - l; jL[i] = P - r; }
      const double nrN = nR[NL - 1];
      noseS += noseC * (nrN - noseS);
      const double nrefl = -0.92 * noseS;
      njL[NL] = nrefl;
      out += 0.8 * (nrN + nrefl);
      for (int j = 1; j < NL; j++) { const double l = nL[j], r = nR[j - 1], P = nk1[j] * r + nk2[j] * l; njR[j] = P - l; njL[j] = P - r; }
      for (int j = 0; j < NL; j++) { nR[j] = njR[j] * loss; nL[j] = njL[j + 1] * loss; }
    }
    if (fn != 0) { jR[inj] += fn; jL[inj] += fn; }
    for (int i = 0; i < N; i++) { R[i] = jR[i] * loss; L[i] = jL[i + 1] * loss; }
    return out;
  }
};

// ---------------------------------------------------------------- LF glottal model
struct LF { double Te = 0.6, eps = 1, shift = 0, invDelta = 1, omega = 1, alpha = 0, E0 = 1; };
inline void lfSetup(double Rd, LF& o) {
  Rd = clamp(Rd, 0.5, 2.7);
  const double Ra = -0.01 + 0.048 * Rd, Rk = 0.224 + 0.118 * Rd;
  const double Rg = (Rk / 4) * (0.5 + 1.2 * Rk) / (0.11 * Rd - Ra * (0.5 + 1.2 * Rk));
  const double Ta = Ra, Tp = 1 / (2 * Rg), Te = Tp + Tp * Rk;
  const double eps = 1 / Ta, shift = std::exp(-eps * (1 - Te)), Delta = 1 - shift;
  const double omega = PI / Tp, s = std::sin(omega * Te);
  const double ret = -1 / eps + shift * (1 - Te) / Delta;
  auto open = [&](double al) { return -((al * s - omega * std::cos(omega * Te)) + omega * std::exp(-al * Te)) / (s * (al * al + omega * omega)); };
  double lo = -200, hi = 200;
  for (int k = 0; k < 40; k++) {
    const double mid = 0.5 * (lo + hi), f = open(mid) + ret, flo = open(lo) + ret;
    if ((f > 0) == (flo > 0)) lo = mid; else hi = mid;
  }
  const double alpha = 0.5 * (lo + hi);
  o.Te = Te; o.eps = eps; o.shift = shift; o.invDelta = 1 / Delta; o.omega = omega; o.alpha = alpha;
  o.E0 = -1 / (s * std::exp(alpha * Te));
}
inline double lfWave(double tn, const LF& o) {
  return tn > o.Te ? (o.shift - std::exp(-o.eps * (tn - o.Te))) * o.invDelta : o.E0 * std::exp(o.alpha * tn) * std::sin(o.omega * tn);
}
inline const double* rmsTab() {
  static double t[24]; static bool done = false;
  if (!done) { LF o; for (int k = 0; k < 24; k++) { lfSetup(0.5 + k * 0.1, o); double s = 0; const int M = 2000; for (int i = 0; i < M; i++) { const double g = lfWave((double) i / M, o); s += g * g; } t[k] = std::sqrt(s / M); } done = true; }
  return t;
}
inline double rmsAt(double Rd) { const double* T = rmsTab(); const double p = clamp((Rd - 0.5) * 10, 0, 22.999); const int i = (int) std::floor(p); return lerp(T[i], T[i + 1], p - i); }

// ---------------------------------------------------------------- envelopes, LFOs
struct ModEnv {
  double v = 0, t = 0; int st = 0;
  void gateOn() { st = 1; t = 0; }
  void gateOff() { if (st) st = 4; }
  double step(double dtms, double a, double d, double s, double r, bool loop) {
    switch (st) {
      case 1: v += dtms / std::max(a, 0.5); if (v >= 1) { v = 1; st = 2; t = 0; } break;
      case 2: t += dtms; v = s + (v - s) * std::exp(-dtms / std::max(d * 0.25, 0.3)); if (t >= d) { if (loop) st = 1; else { st = 3; v = s; } } break;
      case 3: v = s; break;
      case 4: v *= std::exp(-dtms / std::max(r * 0.2, 0.3)); if (v < 1e-4) { v = 0; st = 0; } break;
    }
    return v;
  }
};
inline double lfoShape(int shape, double ph, double r0, double r1) {
  switch (shape) {
    case 0: return std::sin(TAU * ph);
    case 1: return ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph;
    case 2: return 2 * ph - 1;
    case 3: return ph < 0.5 ? 1 : -1;
    case 4: return r1;
    default: { const double t = ph * ph * (3 - 2 * ph); return r0 + (r1 - r0) * t; }
  }
}

struct Syl { std::vector<int> on; int v = AX; std::vector<int> off; };
struct Seg { Art a; double vo = 1, asp = 0, fr = 0, bu = 0, dur = 0, tt = 30; bool nuc = false; int sy = 0; };
constexpr int TICK = 16, SEG_POOL = 24, MAXV = 10;

class Synth;

// ---------------------------------------------------------------- voice
class Voice {
public:
  Synth* syn = nullptr; int idx = 0;
  Tract tract; Art art, tg; uint32_t seed = 0;
  bool active = false, gate = false, sustained = false, pendingRel = false, inPhrase = false, firstSyl = true;
  int note = 60, ch = 0, est = 0; double vel = 0.8, env = 0, age = 0; uint64_t order = 0;
  double o1 = 0, o2 = 0, gl = 0.7, gr = 0.7, pan0 = 0;
  double f = 220, gn = 60, vibPh = 0, drift = 0, dT = 0; int dCount = 0;
  double t = 0, wlen = 1.0 / 220, invLen = 220, ten = 0.6, shim = 1, gGain = 1, aspGain = 0.1;
  double fricAmt = 0, hp = 0, lpS = 0, burst = 0, vo = 1, asp = 0, fr = 0, closeF = 1, Leff = 17.5;
  LF lf; double aC = 0.001, dC = 0.001, rC = 0.999, vamp = 1, ampMod = 1;
  double src[NS] {}, dst[ND] {};
  ModEnv e2, e3; double lph[2] {}, lr0[2] {}, lr1[2] {}; double rand_ = 0, pat = 0;
  Seg pool[SEG_POOL]; int ql = 0, qi = 0, sy = -1; double segT = 0, nucT = 0;
  Art tmpA, tmpB;

  double rnd() { uint32_t s = seed; s ^= s << 13; s ^= s >> 17; s ^= s << 5; seed = s; return (double) s / 2147483648.0 - 1; }
  inline void start(int note, double vel, uint64_t order, int ch, int sy);
  inline void legato(int note, double vel, int ch, int sy, bool retrig);
  inline void release();
  inline void reallyRelease();
  void finish() { active = false; gate = false; pendingRel = false; env = 0; est = 0; tract.reset(); inPhrase = false; }
  inline void setEnvTimes();
  inline void fillVowel(Seg& s, int code, int syl_) { vowelShape(code, s.a); s.vo = 1; s.asp = 0; s.fr = 0; s.bu = 0; s.dur = 0; s.tt = 45; s.nuc = true; s.sy = syl_; }
  inline void fillCons(Seg& s, int code, const Art& base, int sy);
  inline int pushCons(int n, int code, const Art& base, int sy);
  inline const Art& vowelBase(int sy, int which);
  inline int onset(int sy, int n);
  inline int queueCoda(int n);
  inline void beginSyllable(int sy, bool withCoda);
  inline void advanceTo(int sy);
  inline double syllableBudget(int sy);
  inline Seg* phraseTick(double dtms);
  inline void computeMods(double dtms);
  inline Seg* targets();
  inline void shape();
  inline void tick();
  inline void newPeriod();
  inline void sample();
};

// ---------------------------------------------------------------- the instrument
class Synth {
public:
  double sr = 48000, fsT = 96000, dtT = 1.0 / 96000; int os = 2, maxN = MAXN;
  double p[NP];
  float mod[NS * ND] {}; int routes[NS * ND]; int nRoutes = 0;
  std::vector<Syl> syl; int phPos = -1, lastSy = -1; double lastOnT = -1e9, idleT = 0, time = 0;
  Voice voices[MAXV]; int nV = MAXV;
  double bendSemis = 0, bend = 0, press = 0, slide = 0, mw = 0; bool sustainOn = false;
  double chPress[16] {}, chSlide[16] {}, chBend[16] {};
  double gph[2] {}, gr0[2] {}, gr1[2] {}; uint32_t gseed = 991;
  struct StackE { int n; double v; int ch; }; StackE stack[16]; int nStack = 0;
  uint64_t order = 0; int cc = 1, lastNote = -1;
  double dcxL = 0, dcyL = 0, dcxR = 0, dcyR = 0, toneL = 0, toneR = 0, toneC = 0.5, outGain = 2.5, peak = 0;
  double hpC = 0, lpC = 0;
  // halfband + reverb state
  double hbTc[32]; int hbTj[32]; int hbN = 0; double hbBufL[64] {}, hbBufR[64] {}; unsigned hbPosL = 0, hbPosR = 0;
  struct Line { std::vector<float> b; int i = 0; float s = 0; };
  Line cL[8], cR[8], aL[4], aR[4]; double revFb = 0.82, revDamp = 0.28;

  Synth() {
    rmsTab();
    const ParamInfo* t = paramInfo(); for (int i = 0; i < NP; i++) p[i] = t[i].def;
    defaultMods();
    setSampleRate(48000);
  }
  void defaultMods() {
    std::memset(mod, 0, sizeof mod);
    setModN("mw", "morph", 1); setModN("press", "y", 0.3); setModN("press", "amp", 0.3); setModN("press", "tension", 0.2); setModN("slide", "x", 0.35);
    rebuildRoutes();
  }
  void setSampleRate(double rate) {
    sr = rate; os = sr > 60000 ? 1 : 2; fsT = sr * os; dtT = 1 / fsT;
    maxN = std::min(MAXN, (int) std::ceil(27 * fsT / C) + 4);
    hbPosL = hbPosR = 0; std::memset(hbBufL, 0, sizeof hbBufL); std::memset(hbBufR, 0, sizeof hbBufR);
    dcxL = dcyL = dcxR = dcyR = toneL = toneR = 0; cc = 1;
    for (int i = 0; i < MAXV; i++) { voices[i] = Voice(); voices[i].syn = this; voices[i].idx = i; voices[i].tract.fsT = fsT; voices[i].seed = (uint32_t) (2463534242u + (uint32_t) i * 7919u); }
    hpC = 1 - std::exp(-TAU * 450 / fsT); lpC = 1 - std::exp(-TAU * 4200 / fsT);
    // halfband
    { const int K = 15; double sum = 0; hbN = 0;
      for (int j = 0; j <= 2 * K; j++) { const int k = j - K; double h;
        if (k == 0) h = 0.5; else if (std::abs(k) % 2 == 0) continue; else h = std::sin(PI * k / 2) / (PI * k);
        const double wv = 0.42 - 0.5 * std::cos(TAU * (j + 0.5) / (2 * K + 1)) + 0.08 * std::cos(2 * TAU * (j + 0.5) / (2 * K + 1));
        h *= wv; hbTj[hbN] = j; hbTc[hbN] = h; hbN++; sum += h; }
      for (int i = 0; i < hbN; i++) hbTc[i] /= sum; }
    { const double sc = sr / 44100; const int combs[8] = { 1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617 }, aps[4] = { 556, 441, 341, 225 };
      for (int k = 0; k < 8; k++) { cL[k].b.assign(std::max(8, (int) std::lround(combs[k] * sc)), 0.f); cR[k].b.assign(std::max(8, (int) std::lround((combs[k] + 23) * sc)), 0.f); }
      for (int k = 0; k < 4; k++) { aL[k].b.assign(std::max(8, (int) std::lround(aps[k] * sc)), 0.f); aR[k].b.assign(std::max(8, (int) std::lround((aps[k] + 23) * sc)), 0.f); } }
    syl.reserve(512);
    rebuildRoutes(); tone();
  }
  void setModN(const char* s, const char* d, double v) { int si = -1, di = -1; for (int i = 0; i < NS; i++) if (!std::strcmp(s, srcName(i))) si = i; for (int i = 0; i < ND; i++) if (!std::strcmp(d, dstName(i))) di = i; if (si >= 0 && di >= 0) mod[si * ND + di] = (float) v; }
  void rebuildRoutes() { nRoutes = 0; for (int i = 0; i < NS * ND; i++) if (mod[i] != 0) routes[nRoutes++] = i; }
  void setMod(int s, int d, double v) { if (s < 0 || s >= NS || d < 0 || d >= ND) return; mod[s * ND + d] = (float) clamp(v, -1, 1); rebuildRoutes(); }
  void setPhrase(const std::vector<Syl>& s) { syl = s; phPos = -1; for (auto& vc : voices) if (vc.active) vc.inPhrase = false; }
  // audio-thread safe: swaps storage instead of copying
  void swapPhrase(std::vector<Syl>& s) { syl.swap(s); phPos = -1; for (auto& vc : voices) if (vc.active) vc.inPhrase = false; }
  double grnd() { uint32_t s = gseed; s ^= s << 13; s ^= s >> 17; s ^= s << 5; gseed = s; return (double) s / 2147483648.0 - 1; }
  void tone() { const double hi = sr * 0.45, fc = 700 * std::pow(hi / 700, p[P_bright]); toneC = 1 - std::exp(-TAU * fc / sr); }
  void setParam(int k, double v) {
    if (k < 0 || k >= NP) return;
    const double old = p[k]; p[k] = v;
    if (k == P_bright) tone();
    if (k == P_bend) bendSemis = bend * v;
    if (k == P_voices) limitVoices();
    if (k == P_attack || k == P_decay || k == P_release) for (auto& vc : voices) if (vc.active) vc.setEnvTimes();
    if ((k == P_mono || k == P_mpe) && old != v) allOff();
    if (k == P_phOn && !v) for (auto& vc : voices) vc.inPhrase = false;
  }
  void limitVoices() { int n = 0; for (auto& vc : voices) if (vc.active && vc.gate && ++n > p[P_voices]) vc.release(); }
  void setBend(double v, int ch) { if (p[P_mpe] && ch > 0) { chBend[ch & 15] = v; return; } bend = v; bendSemis = v * p[P_bend]; }
  void setPressure(double v, int ch) { if (p[P_mpe] && ch > 0) chPress[ch & 15] = v; else press = v; }
  void setSlide(double v, int ch) { if (p[P_mpe] && ch > 0) chSlide[ch & 15] = v; else slide = v; }
  void polyAT(int n, double v) { for (auto& vc : voices) if (vc.active && vc.note == n) vc.pat = v; }
  int nextSyllable() {
    if (!p[P_phOn] || syl.empty()) return -1;
    if (time - lastOnT < 0.03 && lastSy >= 0) { lastOnT = time; return lastSy; }
    int nx = phPos + 1;
    if (nx >= (int) syl.size()) nx = p[P_phLoop] ? 0 : (int) syl.size() - 1;
    phPos = nx; lastSy = nx; lastOnT = time; return nx;
  }
  const StackE* monoTarget() const {
    if (!nStack) return nullptr;
    const int pr = (int) p[P_prio];
    if (pr == 1) { const StackE* b = &stack[0]; for (int i = 0; i < nStack; i++) if (stack[i].n < b->n) b = &stack[i]; return b; }
    if (pr == 2) { const StackE* b = &stack[0]; for (int i = 0; i < nStack; i++) if (stack[i].n > b->n) b = &stack[i]; return b; }
    return &stack[nStack - 1];
  }
  void stackRemove(int n, int ch, bool matchCh) { int j = 0; for (int i = 0; i < nStack; i++) if (!(stack[i].n == n && (!matchCh || stack[i].ch == ch))) stack[j++] = stack[i]; nStack = j; }
  void noteOn(int note, double vel, int ch) {
    vel = clamp(vel, 0.02, 1); order++;
    if (p[P_mono]) {
      stackRemove(note, ch, false);
      if (nStack >= 16) { for (int i = 1; i < 16; i++) stack[i - 1] = stack[i]; nStack = 15; }
      stack[nStack++] = { note, vel, ch };
      Voice& vc = voices[0]; const StackE tgt = *monoTarget();
      if (vc.active && vc.gate && !vc.pendingRel) {
        if (tgt.n != vc.note || tgt.n == note) { vc.order = order; vc.legato(tgt.n, tgt.v, tgt.ch, tgt.n == note ? nextSyllable() : -1, true); }
      } else vc.start(tgt.n, tgt.v, order, tgt.ch, nextSyllable());
      lastNote = note; return;
    }
    const int sy = nextSyllable();
    const int lim = std::min((int) p[P_voices], nV);
    Voice* pick = nullptr;
    for (int i = 0; i < lim; i++) { Voice& vc = voices[i]; if (vc.active && vc.note == note && !vc.gate) { pick = &vc; break; } }
    if (!pick) for (int i = 0; i < lim; i++) if (!voices[i].active) { pick = &voices[i]; break; }
    if (!pick) { double best = 1e300; for (int i = 0; i < lim; i++) { Voice& vc = voices[i]; const double sc = (vc.gate ? 10 : 0) + vc.env + vc.order * 1e-9; if (sc < best) { best = sc; pick = &vc; } } }
    pick->active = false; pick->start(note, vel, order, ch, sy);
    lastNote = note;
  }
  void noteOff(int note, int ch) {
    const bool mpe = p[P_mpe] != 0;
    if (p[P_mono]) {
      stackRemove(note, ch, mpe);
      Voice& vc = voices[0]; const StackE* tgt = monoTarget();
      if (tgt) { if (tgt->n != vc.note) vc.legato(tgt->n, tgt->v, tgt->ch, -1, false); }
      else if (sustainOn) vc.sustained = true; else vc.release();
      return;
    }
    for (auto& vc : voices) if (vc.active && vc.gate && !vc.pendingRel && vc.note == note && (!mpe || vc.ch == ch) && !vc.sustained) { if (sustainOn) vc.sustained = true; else vc.release(); }
  }
  void sustain(bool on) { sustainOn = on; if (!on) for (auto& vc : voices) if (vc.active && vc.sustained) { vc.sustained = false; vc.release(); } }
  void allOff() { nStack = 0; sustainOn = false; for (auto& vc : voices) if (vc.active) { vc.sustained = false; vc.pendingRel = false; vc.reallyRelease(); } }
  int activeCount() const { int n = 0; for (auto& vc : voices) if (vc.active) n++; return n; }
  // [8 art, length, syllable, phrase pos, 11 sources]
  void telemetry(double* out) const {
    const Voice* best = nullptr;
    for (auto& vc : voices) if (vc.active && (!best || vc.order > best->order)) best = &vc;
    if (!best) { out[0] = -1; return; }
    out[0] = best->art.x; out[1] = best->art.y; out[2] = best->art.w; out[3] = best->art.lips; out[4] = best->art.phar; out[5] = best->art.vel; out[6] = best->art.tip; out[7] = best->art.lc;
    out[8] = best->Leff; out[9] = best->inPhrase ? best->sy : -1; out[10] = phPos;
    for (int i = 0; i < NS; i++) out[11 + i] = best->src[i];
  }
  double lfoRate(int L) const {
    const int base = L ? P_l2shape : P_l1shape;   // shape, rate, sync, div, amt, retrig are consecutive
    return p[base + 2] ? (p[P_bpm] / 60) / LFO_DIVS[(int) clamp(p[base + 3], 0, 9)] : p[base + 1];
  }
  void globalTick(double dt) {
    for (int L = 0; L < 2; L++) { gph[L] += lfoRate(L) * dt; if (gph[L] >= 1) { gph[L] -= std::floor(gph[L]); gr0[L] = gr1[L]; gr1[L] = grnd(); } }
    time += dt;
    bool gated = false; for (auto& vc : voices) if (vc.active && vc.gate) { gated = true; break; }
    if (gated) idleT = 0; else { idleT += dt; if (idleT > p[P_phReset] && phPos >= 0) phPos = -1; }
  }
  inline double hb(double* buf, unsigned& pos, double a, double b) {
    buf[pos & 63] = a; pos++; buf[pos & 63] = b; pos++;
    double y = 0; const unsigned q = pos - 1;
    for (int i = 0; i < hbN; i++) y += hbTc[i] * buf[(q - hbTj[i]) & 63];
    return y;
  }
  inline double revCh(double x, Line* cs, Line* as) {
    double o = 0; const double fb = revFb, d = revDamp;
    for (int k = 0; k < 8; k++) { Line& c = cs[k]; const double y = c.b[c.i]; c.s = (float) (y * (1 - d) + c.s * d); c.b[c.i] = (float) (x + c.s * fb); if (++c.i >= (int) c.b.size()) c.i = 0; o += y; }
    for (int k = 0; k < 4; k++) { Line& a = as[k]; const double y = a.b[a.i]; const double z = o - y; a.b[a.i] = (float) (o + y * 0.5); o = z; if (++a.i >= (int) a.b.size()) a.i = 0; }
    return o;
  }
  void render(float* outL, float* outR, int n) {
    const double master = p[P_master] * p[P_master] * outGain * 2, room = p[P_room];
    double pk = 0;
    for (int s = 0; s < n; s++) {
      if (--cc <= 0) { cc = TICK; globalTick(TICK / sr); for (int v = 0; v < nV; v++) if (voices[v].active) voices[v].tick(); }
      double a1L = 0, a1R = 0, a2L = 0, a2R = 0;
      for (int v = 0; v < nV; v++) {
        Voice& vc = voices[v]; if (!vc.active) continue;
        vc.sample();
        a1L += vc.o1 * vc.gl; a1R += vc.o1 * vc.gr; a2L += vc.o2 * vc.gl; a2R += vc.o2 * vc.gr;
      }
      double l, r;
      if (os == 2) { l = hb(hbBufL, hbPosL, a1L, a2L); r = hb(hbBufR, hbPosR, a1R, a2R); } else { l = a1L; r = a1R; }
      double y = l - dcxL + 0.995 * dcyL; dcxL = l; dcyL = y; toneL += toneC * (y - toneL); l = toneL;
      y = r - dcxR + 0.995 * dcyR; dcxR = r; dcyR = y; toneR += toneC * (y - toneR); r = toneR;
      l *= master; r *= master;
      if (room > 0.001) { const double x = (l + r) * 0.015; const double wl = revCh(x, cL, aL), wr = revCh(x, cR, aR); l += wl * room * 3; r += wr * room * 3; }
      l = std::tanh(l); r = std::tanh(r);
      outL[s] = (float) l; outR[s] = (float) r;
      const double m = l < 0 ? -l : l; if (m > pk) pk = m;
    }
    peak = pk;
  }
};

// ---------------------------------------------------------------- voice implementation
inline void Voice::setEnvTimes() {
  const double* P = syn->p; const double s = syn->sr;
  aC = 1 - std::exp(-1 / (s * std::max(P[P_attack], 1.0) * 0.001 / 1.6));
  dC = 1 - std::exp(-1 / (s * std::max(P[P_decay], 5.0) * 0.001 / 4));
  rC = std::exp(-1 / (s * std::max(P[P_release], 5.0) * 0.001 / 5));
}
inline void Voice::start(int note_, double vel_, uint64_t order_, int ch_, int sy_) {
  const double* P = syn->p; const bool was = active;
  note = note_; vel = vel_; ch = ch_; gate = true; sustained = false; pendingRel = false; order = order_;
  vamp = 0.3 + 0.7 * std::pow(vel, 1.3);
  gn = (P[P_glideMode] == 1 && syn->lastNote >= 0) ? syn->lastNote : note;
  age = 0; est = 1; pat = 0; rand_ = rnd();
  e2.gateOn(); e3.gateOn();
  if (P[P_l1retrig]) { lph[0] = 0; lr0[0] = lr1[0]; lr1[0] = rnd(); }
  if (P[P_l2retrig]) { lph[1] = 0; lr0[1] = lr1[1]; lr1[1] = rnd(); }
  setEnvTimes();
  pan0 = clamp(((note - 60) / 30.0) * P[P_spread] * 0.8 + rnd() * P[P_spread] * 0.35, -1, 1);
  inPhrase = sy_ >= 0 && !syn->syl.empty();
  if (inPhrase) beginSyllable(sy_, false);
  if (!was) {
    tract.reset(); env = 0; vibPh = (rnd() + 1) * PI; drift = 0; dT = 0; dCount = 0;
    ten = clamp(P[P_tension] + (vel - 0.6) * 0.3, 0, 1);
    t = 0; hp = 0; lpS = 0; burst = 0;
    computeMods(0);
    targets();
    art = tg;
    vo = inPhrase ? pool[0].vo : 1; asp = 0; fr = 0;
    shape();
    newPeriod();
  }
  active = true;
}
inline void Voice::legato(int note_, double vel_, int ch_, int sy_, bool retrig) {
  note = note_; vel = vel_; ch = ch_;
  vamp = 0.3 + 0.7 * std::pow(vel, 1.3); gate = true; sustained = false; pendingRel = false;
  if (est == 3) est = 1;
  if (retrig && syn->p[P_legRetrig]) { e2.gateOn(); e3.gateOn(); }
  if (sy_ >= 0 && !syn->syl.empty()) { firstSyl = true; if (inPhrase) advanceTo(sy_); else { inPhrase = true; beginSyllable(sy_, false); } }
}
inline void Voice::release() {
  if (pendingRel) return;
  if (inPhrase && gate) { const int n = queueCoda(0); if (n > 0) { ql = n; qi = 0; segT = 0; nucT = 0; pendingRel = true; return; } }
  reallyRelease();
}
inline void Voice::reallyRelease() { pendingRel = false; gate = false; est = 3; e2.gateOff(); e3.gateOff(); setEnvTimes(); }
inline void Voice::fillCons(Seg& sg, int code, const Art& base, int sy_) {
  const ConSpec& c = CONS[code]; const double s = clamp(syn->p[P_phCons], 0, 1);
  sg.a = base;
  for (int k = 0; k < 8; k++) if (!std::isnan(c.o[k])) sg.a.at(k) = lerp(const_cast<Art&>(base).at(k), c.o[k], 0.25 + 0.75 * s);
  sg.vo = lerp(1, c.vo, s); sg.asp = c.asp * s; sg.fr = c.fr * s; sg.bu = c.bu * s;
  sg.dur = c.dur * (0.6 + 0.4 * s); sg.tt = c.tt; sg.nuc = false; sg.sy = sy_;
}
inline int Voice::pushCons(int n, int code, const Art& base, int sy_) {
  if (code == CH_ || code == JH_) { fillCons(pool[n], code == CH_ ? T_ : D_, base, sy_); pool[n].dur *= 0.7; pool[n].bu *= 0.5; n++; code = code == CH_ ? SH_ : ZH_; }
  if (code < 0 || code >= 22 || n >= SEG_POOL - 2) return n;
  fillCons(pool[n], code, base, sy_); return n + 1;
}
inline const Art& Voice::vowelBase(int sy_, int which) {
  const int v = syn->syl[sy_].v; const int code = DIPH[v][0] >= 0 ? DIPH[v][which] : v;
  Art& o = which ? tmpB : tmpA; vowelShape(code, o); return o;
}
inline int Voice::onset(int sy_, int n) {
  const Syl& S = syn->syl[sy_];
  const Art base = vowelBase(sy_, 0);
  for (int c : S.on) n = pushCons(n, c, base, sy_);
  fillVowel(pool[n], DIPH[S.v][0] >= 0 ? DIPH[S.v][0] : S.v, sy_);
  return n + 1;
}
inline int Voice::queueCoda(int n) {
  if (sy < 0 || sy >= (int) syn->syl.size()) return n;
  const Syl& S = syn->syl[sy];
  Art base = vowelBase(sy, 0);
  if (DIPH[S.v][0] >= 0) { base = vowelBase(sy, 1); Seg& g = pool[n]; fillVowel(g, DIPH[S.v][1], sy); g.nuc = false; g.dur = 150; g.tt = 70; n++; }
  for (int c : S.off) n = pushCons(n, c, base, sy);
  return n;
}
inline void Voice::beginSyllable(int sy_, bool withCoda) {
  firstSyl = true;
  int n = withCoda ? queueCoda(0) : 0;
  n = onset(sy_, n);
  ql = n; qi = 0; segT = 0; nucT = 0; sy = sy_;
}
inline void Voice::advanceTo(int sy_) { int n = queueCoda(0); n = onset(sy_, n); ql = n; qi = 0; segT = 0; nucT = 0; sy = sy_; }
inline double Voice::syllableBudget(int sy_) {
  const Syl& S = syn->syl[sy_]; double t2 = 0;
  for (int c : S.on) t2 += (c >= 0 && c < 22) ? CONS[c].dur : 100;
  for (int c : S.off) t2 += (c >= 0 && c < 22) ? CONS[c].dur : 100;
  if (DIPH[S.v][0] >= 0) t2 += 150;
  return std::max(70.0, syn->p[P_phLen] - t2);
}
inline Seg* Voice::phraseTick(double dtms) {
  const double* P = syn->p;
  Seg* sg = &pool[qi];
  segT += dtms; if (sg->nuc) nucT += dtms;
  if (!sg->nuc && segT >= sg->dur) {
    if (sg->bu > 0) burst = std::max(burst, sg->bu);
    if (qi < ql - 1) { qi++; segT = 0; sg = &pool[qi]; }
    else if (pendingRel) reallyRelease();
  }
  const double budget = firstSyl ? std::max(syllableBudget(sy), P[P_phWait]) : syllableBudget(sy);
  if (sg->nuc && gate && !pendingRel && P[P_phAuto] && nucT >= budget) {
    firstSyl = false;
    int nx = sy + 1; if (nx >= (int) syn->syl.size()) nx = P[P_phLoop] ? 0 : -1;
    if (nx >= 0) { advanceTo(nx); if (order == syn->order) syn->phPos = nx; sg = &pool[0]; }
  }
  return sg;
}
inline void Voice::computeMods(double dtms) {
  const double* P = syn->p;
  src[0] = e2.step(dtms, P[P_e2a], P[P_e2d], P[P_e2s], P[P_e2r], P[P_e2loop] != 0);
  src[1] = e3.step(dtms, P[P_e3a], P[P_e3d], P[P_e3s], P[P_e3r], P[P_e3loop] != 0);
  for (int L = 0; L < 2; L++) {
    const int base = L ? P_l2shape : P_l1shape; const int shp = (int) P[base]; double val;
    if (P[base + 5]) {
      double rate = syn->lfoRate(L) * std::pow(2.0, dst[L ? D_L2RATE : D_L1RATE] * 4);
      lph[L] += rate * dtms * 0.001;
      if (lph[L] >= 1) { lph[L] -= std::floor(lph[L]); lr0[L] = lr1[L]; lr1[L] = rnd(); }
      val = lfoShape(shp, lph[L], lr0[L], lr1[L]);
    } else val = lfoShape(shp, syn->gph[L], syn->gr0[L], syn->gr1[L]);
    src[2 + L] = val * clamp(P[base + 4] + dst[L ? D_L2AMT : D_L1AMT], 0, 1);
  }
  src[4] = vel; src[5] = clamp((note - 60) / 36.0, -1, 1); src[6] = syn->mw;
  const bool mpe = P[P_mpe] && ch > 0;
  src[7] = std::max(mpe ? syn->chPress[ch] : syn->press, pat);
  src[8] = mpe ? syn->chSlide[ch] : syn->slide;
  src[9] = mpe ? syn->chBend[ch] : syn->bend;
  src[10] = rand_;
  for (int i = 0; i < ND; i++) dst[i] = 0;
  for (int i = 0; i < syn->nRoutes; i++) { const int r = syn->routes[i]; dst[r % ND] += src[r / ND] * syn->mod[r]; }
}
inline Seg* Voice::targets() {
  const double* P = syn->p; double* d = dst; Seg* sg = nullptr;
  if (inPhrase && !syn->syl.empty()) { sg = &pool[qi]; tg = sg->a; }
  else {
    const double m = clamp(P[P_morph] + d[D_MORPH], 0, 1);
    tg.x = lerp(P[P_x], P[P_bx], m); tg.y = lerp(P[P_y], P[P_by], m); tg.w = lerp(P[P_w], P[P_bw], m);
    tg.lips = lerp(P[P_lips], P[P_blips], m); tg.phar = lerp(P[P_phar], P[P_bphar], m); tg.vel = lerp(P[P_vel], P[P_bvel], m); tg.tip = P[P_tip]; tg.lc = 0;
  }
  if (!sg || sg->nuc) { const double tn = P[P_tune] * sstep(300, 900, f); if (tn > 0) { tg.y += (1 - tg.y) * 0.65 * tn; tg.lips += (1 - tg.lips) * 0.6 * tn; } }
  tg.x = clamp(tg.x + d[D_X], 0, 1); tg.y = clamp(tg.y + d[D_Y], sg ? -1 : 0, 1); tg.w = clamp(tg.w + d[D_W], 0, 1);
  tg.lips = clamp(tg.lips + d[D_LIPS], 0, 1); tg.phar = clamp(tg.phar + d[D_PHAR], 0, 1); tg.vel = clamp(tg.vel + d[D_VEL], 0, 1);
  tg.tip = clamp(tg.tip + d[D_TIP], 0, 1);
  return sg;
}
inline void Voice::shape() {
  const double* P = syn->p; double* d = dst;
  Leff = clamp(P[P_length] + d[D_LENGTH] * 8 + clamp(P[P_larynx] + d[D_LARYNX], -1, 1) * 1.2, 8, 26);
  const int N = (int) clamp((double) std::lround(Leff * syn->fsT / C), 20, syn->maxN - 1);
  tract.resize(N);
  const AInfo info = buildAreas(art, N, tract.A);
  tract.setShape(art.vel * 2.2);
  const double tight = clamp((0.55 - info.minA) / 0.5, 0, 1), hiss = clamp(P[P_fric] + d[D_FRIC], 0, 1);
  fricAmt = hiss * tight * tight * 0.4 + fr * 0.45 * (0.25 + 0.75 * tight) + burst * 0.9;
  tract.inj = (int) clamp(info.minI + 1, 2, N - 2);
  closeF = clamp(info.minA / 0.09, 0, 1);
}
inline void Voice::tick() {
  const double* P = syn->p; const double dt = TICK / syn->sr, dtms = dt * 1000;
  age += dt;
  computeMods(dtms);
  const double* d = dst;
  const double gl2 = P[P_glide] > 1 ? 1 - std::exp(-dt / (P[P_glide] * 0.001)) : 1;
  gn += (note - gn) * gl2;
  vibPh += TAU * P[P_vibRate] * dt; if (vibPh > TAU) vibPh -= TAU;
  const double vEnv = clamp((age * 1000 - P[P_vibDelay]) / 400, 0, 1);
  if (--dCount <= 0) { dT = rnd() * P[P_human] * 9; dCount = 400 + (int) std::floor((rnd() + 1) * 400); }
  drift += (dT - drift) * 0.004;
  const double cents = std::max(0.0, P[P_vib] + d[D_VIB] * 60) * vEnv * std::sin(vibPh) + drift;
  const double nb = (P[P_mpe] && ch > 0) ? syn->chBend[ch] * P[P_mpeBend] : 0;
  f = clamp(440 * std::pow(2.0, (gn - 69 + syn->bendSemis + nb + d[D_PITCH] * 24) / 12 + cents / 1200), 20, 3000);
  Seg* sg = inPhrase ? phraseTick(dtms) : nullptr;
  targets();
  const double tt = sg ? sg->tt : P[P_artTime];
  const double ka = 1 - std::exp(-dtms / (tt + 1));
  for (int k = 0; k < 8; k++) art.at(k) += (tg.at(k) - art.at(k)) * ka;
  const double kf = 1 - std::exp(-dtms / 6);
  vo += ((sg ? sg->vo : 1) - vo) * kf; asp += ((sg ? sg->asp : 0) - asp) * kf; fr += ((sg ? sg->fr : 0) - fr) * kf;
  burst *= std::exp(-dtms / 7);
  shape();
  const double tt2 = clamp(P[P_tension] + (vel - 0.6) * 0.3 + d[D_TENSION], 0, 1);
  ten += (tt2 - ten) * 0.05;
  aspGain = (clamp(P[P_breath] + d[D_BREATH], 0, 1) * (1.15 - 0.75 * ten) * 0.5 + asp * 0.6) * (0.12 + 0.88 * closeF) + burst * 0.25;
  ampMod = clamp(1 + d[D_AMP], 0, 2);
  const double pan = clamp(pan0 + d[D_PAN], -1, 1);
  gl = std::cos((pan + 1) * PI / 4); gr = std::sin((pan + 1) * PI / 4);
}
inline void Voice::newPeriod() {
  const double* P = syn->p;
  const double ff = f * (1 + rnd() * 0.005 * P[P_human]);
  wlen = 1 / ff; invLen = ff;
  const double Rd = clamp(3 * (1 - ten), 0.5, 2.7);
  lfSetup(Rd, lf);
  shim = 1 + rnd() * 0.05 * P[P_human];
  gGain = 0.5 / rmsAt(Rd) * shim;
  tract.gRefl = 0.66 + 0.26 * ten;
}
inline void Voice::sample() {
  switch (est) {
    case 1: env += (1.25 - env) * aC; if (env >= 1) { env = 1; est = 2; } break;
    case 2: env += (syn->p[P_sustain] - env) * dC; break;
    case 3: env *= rC; if (env < 4e-4) { finish(); o1 = 0; o2 = 0; return; } break;
  }
  const double amp = env * vamp * ampMod, dtT = syn->dtT;
  const double frA = fricAmt * amp, hpC = syn->hpC, lpC = syn->lpC, gv = gGain * vo;
  for (int k = 0; k < 2; k++) {
    const double tn = t * invLen; const bool open = tn < lf.Te;
    const double g = open ? lf.E0 * std::exp(lf.alpha * tn) * std::sin(lf.omega * tn) : (lf.shift - std::exp(-lf.eps * (tn - lf.Te))) * lf.invDelta;
    t += dtT;
    if (t >= wlen) { t -= wlen; newPeriod(); }
    const double n = rnd();
    hp += hpC * (n - hp); lpS += lpC * ((n - hp) - lpS);
    const double s = (g * gv + lpS * aspGain * (open || vo < 0.5 ? 1 : 0.35)) * amp;
    const double o = tract.step(s, frA * n);
    if (k == 0) o1 = o; else o2 = o;
  }
}

} // namespace vts
