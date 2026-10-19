#include "PluginEditor.h"
#include "BinaryData.h"

using namespace vts;

VTSEditor::VTSEditor (VTSProcessor& p) : AudioProcessorEditor (&p), proc (p)
{
    auto options = juce::WebBrowserComponent::Options {}
        .withNativeIntegrationEnabled()
        .withKeepPageLoadedWhenBrowserIsHidden()
        .withResourceProvider ([this] (const juce::String& url) { return getResource (url); })
        .withEventListener ("vts", [this] (const juce::var& payload) { handleMessage (payload); });
    web = std::make_unique<juce::WebBrowserComponent> (options);
    addAndMakeVisible (*web);
    web->goToURL (juce::WebBrowserComponent::getResourceProviderRoot());

    for (auto& v : lastSent) v = std::numeric_limits<double>::quiet_NaN();
    setResizable (true, true);
    setResizeLimits (720, 560, 2400, 1800);
    setSize (1120, 800);
    startTimerHz (30);
}

VTSEditor::~VTSEditor() { stopTimer(); }

void VTSEditor::resized() { if (web) web->setBounds (getLocalBounds()); }

std::optional<juce::WebBrowserComponent::Resource> VTSEditor::getResource (const juce::String& url)
{
    if (url == "/" || url == "/index.html" || url.isEmpty())
    {
        const auto* data = reinterpret_cast<const std::byte*> (BinaryData::index_html);
        return juce::WebBrowserComponent::Resource { std::vector<std::byte> (data, data + BinaryData::index_htmlSize), "text/html" };
    }
    return std::nullopt;
}

void VTSEditor::handleMessage (const juce::var& m)
{
    const auto t = m["t"].toString();
    if (t == "ready")
    {
        pageReady = true;
        for (auto& v : lastSent) v = std::numeric_limits<double>::quiet_NaN();
        web->emitEventIfBrowserIsVisible ("state", proc.getFullState());
        return;
    }
    if (t == "p") { proc.setParamFromUI (m["k"].toString(), (double) m["v"]); return; }
    if (t == "ps")
    {
        if (auto* o = m["o"].getDynamicObject())
            for (const auto& kv : o->getProperties()) proc.setParamFromUI (kv.name.toString(), (double) kv.value);
        return;
    }
    if (t == "on" || t == "off")
    {
        const int ch = juce::jlimit (1, 16, (int) m["ch"] + 1), n = juce::jlimit (0, 127, (int) m["n"]);
        auto msg = t == "on" ? juce::MidiMessage::noteOn (ch, n, (juce::uint8) juce::jlimit (1, 127, (int) std::round ((double) m["v"] * 127)))
                             : juce::MidiMessage::noteOff (ch, n);
        msg.setTimeStamp (juce::Time::getMillisecondCounterHiRes() * 0.001);
        proc.uiMidi.addMessageToQueue (msg);
        return;
    }
    if (t == "mod") { proc.setModFromUI ((int) m["s"] * ND + (int) m["d"], (double) m["v"]); return; }
    if (t == "mods") { if (auto* a = m["a"].getArray()) proc.setAllModsFromUI (*a); return; }
    if (t == "phrase") { proc.setPhraseFromUI (m["s"], m["text"].toString()); return; }
    if (t == "phReset") { proc.sendCommand (2); return; }
    if (t == "panic") { proc.sendCommand (1); return; }
    if (t == "mw") { proc.sendCommand (3, (double) m["v"]); return; }
}

void VTSEditor::timerCallback()
{
    if (! pageReady || web == nullptr) return;
    ++tickCount;
    auto* obj = new juce::DynamicObject();

    juce::Array<juce::var> telArr;
    for (auto& v : proc.tel) telArr.add ((double) v.load());
    obj->setProperty ("tel", telArr);
    obj->setProperty ("pk", (double) proc.peak.load());
    obj->setProperty ("v", proc.activeVoices.load());

    // parameters changed by the host (automation, MIDI mapping, presets)
    auto* changed = new juce::DynamicObject();
    bool any = false;
    const ParamInfo* info = paramInfo();
    for (int i = 0; i < NP; ++i)
    {
        const double v = proc.apvts.getRawParameterValue (info[i].id)->load();
        if (! (v == lastSent[(size_t) i])) { lastSent[(size_t) i] = v; changed->setProperty (info[i].id, v); any = true; }
    }
    if (any) obj->setProperty ("params", juce::var (changed)); else delete changed;

    // output waveform and spectrum for the display
    if (proc.activeVoices.load() > 0 || (tickCount % 15) == 0)
    {
        const int end = proc.scopePos.load();
        const int N = VTSProcessor::scopeSize;
        juce::Array<juce::var> wave;
        for (int i = 0; i < 640; ++i) wave.add ((double) proc.scope[(size_t) ((end - 640 + i + N) & (N - 1))]);
        obj->setProperty ("wave", wave);
        if (tickCount % 2 == 0)
        {
            for (int i = 0; i < N; ++i) fftBuf[(size_t) i] = proc.scope[(size_t) ((end + i) & (N - 1))];
            std::fill (fftBuf.begin() + N, fftBuf.end(), 0.f);
            window.multiplyWithWindowingTable (fftBuf.data(), (size_t) N);
            fft.performFrequencyOnlyForwardTransform (fftBuf.data());
            const double sr = proc.currentSampleRate.load(), df = sr / N;
            const int nb = juce::jmin (N / 2 - 1, (int) (5000 / df));
            juce::Array<juce::var> spec;
            for (int i = 0; i <= nb; ++i) spec.add ((double) juce::Decibels::gainToDecibels (fftBuf[(size_t) i] / (float) (N * 0.25), -140.0f));
            obj->setProperty ("spec", spec);
            obj->setProperty ("df", df);
        }
    }
    web->emitEventIfBrowserIsVisible ("tel", juce::var (obj));
}
