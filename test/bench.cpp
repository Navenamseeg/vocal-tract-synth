#include "../Source/VTEngine.h"
#include <chrono>
#include <cstdio>
using namespace vts;
int main() { Synth s; s.setSampleRate(48000); s.setParam(P_voices, 10); s.setParam(P_room, 0.3);
  int notes[10] = {48,52,55,59,62,65,69,72,74,76}; for (int n : notes) s.noteOn(n, 0.7, 0);
  float L[128], R[128]; const int secs = 10; auto t0 = std::chrono::steady_clock::now();
  for (int i = 0; i < secs * 48000 / 128; i++) s.render(L, R, 128);
  double dt = std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count();
  printf("10 voices: %.1f%% of one core\n", dt / secs * 100); }
