// Renders fixed scenarios with the C++ engine; compare_js.js renders the same with engine.js
#include "../Source/VTEngine.h"
#include <cstdio>
#include <fstream>
using namespace vts;
struct Ev { double t; std::string k; double a, b, c; };
static std::vector<Syl> phrase() {
  auto S = [](std::vector<std::string> on, std::string v, std::vector<std::string> off) { Syl s; for (auto& c : on) s.on.push_back(conCode(c)); s.v = vowCode(v); for (auto& c : off) s.off.push_back(conCode(c)); return s; };
  return { S({"HH"},"EH",{}), S({"L"},"OW",{}), S({"M"},"UW",{"N"}), S({"S"},"IH",{"NG"}), S({"T"},"AY",{"M"}), S({"K"},"AA",{"T","S"}), S({"CH"},"ER",{}) };
}
int main(int argc, char** argv) {
  const int scen = atoi(argv[1]); const double sr = atof(argv[2]);
  Synth s; s.setSampleRate(sr);
  std::vector<Ev> ev;
  if (scen == 0) { ev = { {0.0,"on",57,0.8,0}, {0.6,"on",64,0.6,0}, {1.2,"off",57,0,0}, {1.5,"off",64,0,0} }; }
  if (scen == 1) { s.setParam(P_phOn,1); s.setParam(P_mono,1); s.setPhrase(phrase()); ev = { {0.02,"on",57,0.8,0}, {3.0,"off",57,0,0} }; }
  if (scen == 2) { s.setParam(P_phOn,1); s.setParam(P_mpe,1); s.setPhrase(phrase()); s.setMod(S_LFO1,D_PITCH,0.02); s.setMod(S_ENV2,D_Y,-0.6); s.setMod(S_PRESS,D_LIPS,0.5); s.setMod(S_LFO2,D_X,0.3);
    ev = { {0,"on",57,0.8,1}, {0.01,"on",61,0.8,2}, {0.012,"on",64,0.8,3} };
    for (int i = 0; i < 40; i++) { ev.push_back({0.1+i*0.03,"press",i/40.0,2,0}); ev.push_back({0.1+i*0.03,"bend",i/80.0,3,0}); }
    ev.push_back({1.8,"off",57,1,0}); ev.push_back({1.8,"off",61,2,0}); ev.push_back({1.8,"off",64,3,0}); }
  if (scen == 3) { s.setParam(P_vel,0.8); s.setParam(P_room,0.5); s.setParam(P_l1sync,1); s.setMod(S_LFO1,D_LENGTH,0.3); s.setParam(P_mono,1); s.setParam(P_glide,200);
    ev = { {0,"on",50,0.9,0}, {0.5,"on",62,0.9,0}, {0.9,"off",62,0,0}, {1.6,"off",50,0,0} }; }
  const int n = (int) (2.5 * sr) / 128 * 128; std::vector<float> L(n), R(n);
  size_t ei = 0;
  for (int p = 0; p < n; p += 128) {
    while (ei < ev.size() && ev[ei].t * sr <= p) { const Ev& e = ev[ei++];
      if (e.k == "on") s.noteOn((int) e.a, e.b, (int) e.c); else if (e.k == "off") s.noteOff((int) e.a, (int) e.b);
      else if (e.k == "press") s.setPressure(e.a, (int) e.b); else if (e.k == "bend") s.setBend(e.a, (int) e.b); }
    s.render(&L[p], &R[p], 128);
  }
  std::ofstream f(argv[3], std::ios::binary); f.write((char*) L.data(), n * 4); f.write((char*) R.data(), n * 4);
  return 0;
}
