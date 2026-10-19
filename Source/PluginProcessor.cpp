#include "PluginProcessor.h"
#include "PluginEditor.h"

using namespace vts;

namespace
{
    struct Pretty { const char* id; const char* name; double centre; const char* unit; };
    // display names, skew centre for the knob (0 = linear), unit label
    const Pretty prettyTable[] = {
        { "x", "Tongue position", 0, "" }, { "y", "Tongue constriction", 0, "" }, { "w", "Tongue width", 0, "" }, { "lips", "Lips", 0, "" },
        { "phar", "Throat width", 0, "" }, { "vel", "Nose", 0, "" }, { "tip", "Tongue tip", 0, "" }, { "morph", "Morph", 0, "" },
        { "bx", "Target tongue position", 0, "" }, { "by", "Target constriction", 0, "" }, { "bw", "Target tongue width", 0, "" }, { "blips", "Target lips", 0, "" },
        { "bphar", "Target throat", 0, "" }, { "bvel", "Target nose", 0, "" },
        { "tension", "Tension", 0, "" }, { "breath", "Breath", 0, "" }, { "fric", "Hiss", 0, "" }, { "vib", "Vibrato depth", 0, "ct" },
        { "vibRate", "Vibrato rate", 0, "Hz" }, { "vibDelay", "Vibrato delay", 0, "ms" }, { "human", "Humanize", 0, "" },
        { "length", "Tract length", 0, "cm" }, { "larynx", "Larynx height", 0, "" }, { "tune", "Soprano tuning", 0, "" },
        { "attack", "Attack", 150, "ms" }, { "decay", "Decay", 500, "ms" }, { "sustain", "Sustain", 0, "" }, { "release", "Release", 400, "ms" },
        { "e2a", "Env 2 attack", 150, "ms" }, { "e2d", "Env 2 decay", 500, "ms" }, { "e2s", "Env 2 sustain", 0, "" }, { "e2r", "Env 2 release", 400, "ms" }, { "e2loop", "Env 2 loop", 0, "" },
        { "e3a", "Env 3 attack", 150, "ms" }, { "e3d", "Env 3 decay", 500, "ms" }, { "e3s", "Env 3 sustain", 0, "" }, { "e3r", "Env 3 release", 400, "ms" }, { "e3loop", "Env 3 loop", 0, "" },
        { "l1shape", "LFO 1 shape", 0, "" }, { "l1rate", "LFO 1 rate", 3, "Hz" }, { "l1sync", "LFO 1 sync", 0, "" }, { "l1div", "LFO 1 division", 0, "" }, { "l1amt", "LFO 1 amount", 0, "" }, { "l1retrig", "LFO 1 restart", 0, "" },
        { "l2shape", "LFO 2 shape", 0, "" }, { "l2rate", "LFO 2 rate", 3, "Hz" }, { "l2sync", "LFO 2 sync", 0, "" }, { "l2div", "LFO 2 division", 0, "" }, { "l2amt", "LFO 2 amount", 0, "" }, { "l2retrig", "LFO 2 restart", 0, "" },
        { "bpm", "Tempo (when the host has none)", 0, "bpm" },
        { "mono", "Mono", 0, "" }, { "legRetrig", "Legato restarts envelopes", 0, "" }, { "glideMode", "Glide mode", 0, "" }, { "prio", "Note priority", 0, "" },
        { "glide", "Glide time", 200, "ms" }, { "bend", "Bend range", 0, "st" }, { "mpe", "MPE", 0, "" }, { "mpeBend", "MPE bend range", 0, "st" },
        { "voices", "Polyphony", 0, "" }, { "artTime", "Mouth speed", 40, "ms" }, { "spread", "Stereo spread", 0, "" },
        { "phOn", "Sing words", 0, "" }, { "phAuto", "Keep singing while held", 0, "" }, { "phWait", "Hold before moving on", 600, "ms" },
        { "phLen", "Syllable length", 400, "ms" }, { "phLoop", "Loop words", 0, "" }, { "phReset", "Start over after silence", 3, "s" }, { "phCons", "Consonants", 0, "" },
        { "master", "Level", 0, "" }, { "room", "Room", 0, "" }, { "bright", "Brightness", 0, "" } };

    const Pretty* prettyFor (const char* id)
    {
        for (auto& p : prettyTable) if (! std::strcmp (p.id, id)) return &p;
        return nullptr;
    }
}

juce::AudioProcessorValueTreeState::ParameterLayout VTSProcessor::createLayout()
{
    juce::AudioProcessorValueTreeState::ParameterLayout layout;
    const ParamInfo* info = paramInfo();
    for (int i = 0; i < NP; ++i)
    {
        const auto& p = info[i];
        const auto* pr = prettyFor (p.id);
        const juce::String name = pr ? pr->name : p.id;
        const juce::ParameterID pid { p.id, 1 };
        if (p.kind == 1)
            layout.add (std::make_unique<juce::AudioParameterBool> (pid, name, p.def > 0.5));
        else if (p.kind == 2)
            layout.add (std::make_unique<juce::AudioParameterInt> (pid, name, (int) p.mn, (int) p.mx, (int) p.def));
        else
        {
            juce::NormalisableRange<float> r ((float) p.mn, (float) p.mx);
            if (pr && pr->centre > 0 && pr->centre > p.mn && pr->centre < p.mx) r.setSkewForCentre ((float) pr->centre);
            juce::AudioParameterFloatAttributes attr;
            if (pr && *pr->unit) attr = attr.withLabel (pr->unit);
            layout.add (std::make_unique<juce::AudioParameterFloat> (pid, name, r, (float) p.def, attr));
        }
    }
    return layout;
}

VTSProcessor::VTSProcessor()
    : AudioProcessor (BusesProperties().withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      apvts (*this, nullptr, "VTS", createLayout())
{
    const ParamInfo* info = paramInfo();
    for (int i = 0; i < NP; ++i)
    {
        paramPtr[(size_t) i] = apvts.getRawParameterValue (info[i].id);
        lastParam[(size_t) i] = info[i].def;
    }
    for (int i = 0; i < NS * ND; ++i) { mods[(size_t) i].store (synth.mod[i]); lastMods[(size_t) i] = synth.mod[i]; }
    for (auto& t : tel) t.store (0);
    tel[0].store (-1);
    pendingPhrase.reserve (512);
}

bool VTSProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    const auto out = layouts.getMainOutputChannelSet();
    return out == juce::AudioChannelSet::stereo() || out == juce::AudioChannelSet::mono();
}

void VTSProcessor::prepareToPlay (double sampleRate, int samplesPerBlock)
{
    synth.setSampleRate (sampleRate);
    for (int i = 0; i < NP; ++i) { const double v = paramPtr[(size_t) i]->load(); synth.setParam (i, v); lastParam[(size_t) i] = v; }
    currentSampleRate.store (sampleRate);
    uiMidi.reset (sampleRate);
    tmpL.assign ((size_t) juce::jmax (samplesPerBlock, 512), 0.f);
    tmpR.assign ((size_t) juce::jmax (samplesPerBlock, 512), 0.f);
}

void VTSProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midi)
{
    juce::ScopedNoDenormals noDenormals;
    const int numSamples = buffer.getNumSamples();
    if ((int) tmpL.size() < numSamples) return;   // host broke its promise about block size; stay silent

    // words
    if (phrasePending.load() && phraseLock.tryEnter())
    {
        synth.swapPhrase (pendingPhrase);
        phrasePending.store (false);
        phraseLock.exit();
    }
    // parameters
    const ParamInfo* info = paramInfo();
    for (int i = 0; i < NP; ++i)
    {
        double v = paramPtr[(size_t) i]->load();
        if (info[i].kind != 0) v = std::round (v);
        if (v != lastParam[(size_t) i]) { lastParam[(size_t) i] = v; synth.setParam (i, v); }
    }
    // matrix
    bool modsChanged = false;
    for (int i = 0; i < NS * ND; ++i)
    {
        const float v = mods[(size_t) i].load();
        if (v != lastMods[(size_t) i]) { lastMods[(size_t) i] = v; synth.mod[i] = v; modsChanged = true; }
    }
    if (modsChanged) synth.rebuildRoutes();
    // editor commands
    {
        const auto scope2 = cmdFifo.read (cmdFifo.getNumReady());
        auto run = [this] (const Cmd& c)
        {
            if (c.type == 1) synth.allOff();
            else if (c.type == 2) synth.phPos = -1;
            else if (c.type == 3) synth.mw = c.a;
        };
        for (int i = 0; i < scope2.blockSize1; ++i) run (cmdBuf[(size_t) (scope2.startIndex1 + i)]);
        for (int i = 0; i < scope2.blockSize2; ++i) run (cmdBuf[(size_t) (scope2.startIndex2 + i)]);
    }
    // host tempo drives synced LFOs
    if (auto* ph = getPlayHead())
        if (auto pos = ph->getPosition())
            if (auto bpm = pos->getBpm())
                synth.p[P_bpm] = *bpm;

    uiMidi.removeNextBlockOfMessages (midi, numSamples);

    float* L = tmpL.data();
    float* R = tmpR.data();
    int pos = 0;
    auto renderTo = [&] (int end)
    {
        if (end > pos) { synth.render (L + pos, R + pos, end - pos); pos = end; }
    };
    float blockPeak = 0;
    for (const auto meta : midi)
    {
        const int when = juce::jlimit (0, numSamples, meta.samplePosition);
        renderTo (when);
        blockPeak = juce::jmax (blockPeak, (float) synth.peak);
        const auto m = meta.getMessage();
        const int ch = m.getChannel() - 1;
        if (m.isNoteOn()) synth.noteOn (m.getNoteNumber(), m.getFloatVelocity(), ch);
        else if (m.isNoteOff()) synth.noteOff (m.getNoteNumber(), ch);
        else if (m.isPitchWheel()) synth.setBend ((m.getPitchWheelValue() - 8192) / 8192.0, ch);
        else if (m.isChannelPressure()) synth.setPressure (m.getChannelPressureValue() / 127.0, ch);
        else if (m.isAftertouch()) synth.polyAT (m.getNoteNumber(), m.getAfterTouchValue() / 127.0);
        else if (m.isController())
        {
            const int cc = m.getControllerNumber(), val = m.getControllerValue();
            if (cc == 1) synth.mw = val / 127.0;
            else if (cc == 64) synth.sustain (val >= 64);
            else if (cc == 74) synth.setSlide (val / 127.0, ch);
            else if (cc == 120 || cc == 123) synth.allOff();
        }
        else if (m.isAllNotesOff() || m.isAllSoundOff()) synth.allOff();
    }
    renderTo (numSamples);
    blockPeak = juce::jmax (blockPeak, (float) synth.peak);
    midi.clear();

    const int nCh = buffer.getNumChannels();
    if (nCh >= 2) { buffer.copyFrom (0, 0, L, numSamples); buffer.copyFrom (1, 0, R, numSamples); }
    else if (nCh == 1) { buffer.copyFrom (0, 0, L, numSamples); buffer.addFrom (0, 0, R, numSamples); buffer.applyGain (0.5f); }
    for (int c = 2; c < nCh; ++c) buffer.clear (c, 0, numSamples);

    // telemetry and scope for the editor
    double t[24] {};
    synth.telemetry (t);
    for (int i = 0; i < 24; ++i) tel[(size_t) i].store ((float) t[i]);
    peak.store (juce::jmax (peak.load() * 0.9f, blockPeak));
    activeVoices.store (synth.activeCount());
    int sp = scopePos.load();
    for (int i = 0; i < numSamples; ++i) { scope[(size_t) sp] = 0.5f * (L[i] + R[i]); sp = (sp + 1) & (scopeSize - 1); }
    scopePos.store (sp);
}

// ---------------------------------------------------------------- editor-facing setters
void VTSProcessor::setParamFromUI (const juce::String& id, double v)
{
    if (auto* p = apvts.getParameter (id))
    {
        const float norm = p->convertTo0to1 ((float) v);
        if (std::abs (p->getValue() - norm) > 1e-7f) p->setValueNotifyingHost (norm);
    }
}
void VTSProcessor::setModFromUI (int index, double v)
{
    if (index >= 0 && index < NS * ND) mods[(size_t) index].store ((float) juce::jlimit (-1.0, 1.0, v));
}
void VTSProcessor::setAllModsFromUI (const juce::Array<juce::var>& values)
{
    for (int i = 0; i < NS * ND && i < values.size(); ++i) setModFromUI (i, (double) values[i]);
}
void VTSProcessor::sendCommand (int type, double a, double b)
{
    const auto w = cmdFifo.write (1);
    if (w.blockSize1 > 0) cmdBuf[(size_t) w.startIndex1] = { type, a, b };
    else if (w.blockSize2 > 0) cmdBuf[(size_t) w.startIndex2] = { type, a, b };
}

std::vector<Syl> VTSProcessor::parseSyllables (const juce::var& syllables)
{
    std::vector<Syl> out;
    if (auto* arr = syllables.getArray())
        for (const auto& s : *arr)
        {
            Syl y;
            if (auto* on = s["on"].getArray()) for (const auto& c : *on) { const int k = conCode (c.toString().toStdString()); if (k >= 0) y.on.push_back (k); }
            const int v = vowCode (s["v"].toString().toStdString());
            y.v = v >= 0 ? v : AX;
            if (auto* off = s["off"].getArray()) for (const auto& c : *off) { const int k = conCode (c.toString().toStdString()); if (k >= 0) y.off.push_back (k); }
            out.push_back (std::move (y));
        }
    return out;
}
juce::String VTSProcessor::encodeSyllables (const std::vector<Syl>& syl)
{
    juce::StringArray parts;
    for (const auto& s : syl)
    {
        juce::StringArray on, off;
        for (int c : s.on) on.add (CON_NAMES[c]);
        for (int c : s.off) off.add (CON_NAMES[c]);
        parts.add (on.joinIntoString (" ") + "/" + VOW_NAMES[s.v] + "/" + off.joinIntoString (" "));
    }
    return parts.joinIntoString (";");
}
std::vector<Syl> VTSProcessor::decodeSyllables (const juce::String& text)
{
    std::vector<Syl> out;
    for (const auto& part : juce::StringArray::fromTokens (text, ";", ""))
    {
        const auto f = juce::StringArray::fromTokens (part, "/", "");
        if (f.size() < 2) continue;
        Syl y;
        for (const auto& c : juce::StringArray::fromTokens (f[0], " ", "")) { const int k = conCode (c.toStdString()); if (k >= 0) y.on.push_back (k); }
        const int v = vowCode (f[1].toStdString()); y.v = v >= 0 ? v : AX;
        if (f.size() > 2) for (const auto& c : juce::StringArray::fromTokens (f[2], " ", "")) { const int k = conCode (c.toStdString()); if (k >= 0) y.off.push_back (k); }
        out.push_back (std::move (y));
    }
    return out;
}
void VTSProcessor::setPhraseFromUI (const juce::var& syllables, const juce::String& text)
{
    auto parsed = parseSyllables (syllables);
    {
        const juce::SpinLock::ScopedLockType lock (phraseLock);
        pendingPhrase = parsed;
        phrasePending.store (true);
    }
    currentPhrase = std::move (parsed);
    phraseText = text;
}

juce::var VTSProcessor::getFullState() const
{
    auto* obj = new juce::DynamicObject();
    auto* params = new juce::DynamicObject();
    const ParamInfo* info = paramInfo();
    for (int i = 0; i < NP; ++i) params->setProperty (info[i].id, (double) paramPtr[(size_t) i]->load());
    obj->setProperty ("P", juce::var (params));
    juce::Array<juce::var> m;
    for (int i = 0; i < NS * ND; ++i) m.add ((double) mods[(size_t) i].load());
    obj->setProperty ("mods", m);
    obj->setProperty ("text", phraseText);
    return juce::var (obj);
}

// ---------------------------------------------------------------- state
void VTSProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    auto state = apvts.copyState();
    juce::StringArray m;
    for (int i = 0; i < NS * ND; ++i) m.add (juce::String (mods[(size_t) i].load(), 3));
    state.setProperty ("mods", m.joinIntoString (","), nullptr);
    state.setProperty ("phraseText", phraseText, nullptr);
    state.setProperty ("phraseSyl", encodeSyllables (currentPhrase), nullptr);
    if (auto xml = state.createXml()) copyXmlToBinary (*xml, destData);
}
void VTSProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    auto xml = getXmlFromBinary (data, sizeInBytes);
    if (xml == nullptr || ! xml->hasTagName (apvts.state.getType())) return;
    auto state = juce::ValueTree::fromXml (*xml);
    const auto modStr = state.getProperty ("mods").toString();
    const auto phraseSylStr = state.getProperty ("phraseSyl").toString();
    phraseText = state.getProperty ("phraseText").toString();
    apvts.replaceState (state);
    const auto vals = juce::StringArray::fromTokens (modStr, ",", "");
    if (vals.size() == NS * ND) for (int i = 0; i < NS * ND; ++i) mods[(size_t) i].store (vals[i].getFloatValue());
    auto syl = decodeSyllables (phraseSylStr);
    {
        const juce::SpinLock::ScopedLockType lock (phraseLock);
        pendingPhrase = syl;
        phrasePending.store (true);
    }
    currentPhrase = std::move (syl);
}

juce::AudioProcessorEditor* VTSProcessor::createEditor() { return new VTSEditor (*this); }
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() { return new VTSProcessor(); }
