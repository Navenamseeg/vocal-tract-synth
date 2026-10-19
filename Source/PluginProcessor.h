#pragma once
#include <JuceHeader.h>
#include "VTEngine.h"
#include <atomic>

// Audio side of the plugin: owns the engine, the host parameters, the mod matrix and the sung words.
class VTSProcessor : public juce::AudioProcessor
{
public:
    VTSProcessor();
    ~VTSProcessor() override = default;

    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override {}
    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }
    const juce::String getName() const override { return JucePlugin_Name; }
    bool acceptsMidi() const override { return true; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 2.0; }
    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int) override {}
    const juce::String getProgramName (int) override { return {}; }
    void changeProgramName (int, const juce::String&) override {}
    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    // ---- used by the editor (message thread) ----
    juce::AudioProcessorValueTreeState apvts;
    juce::MidiMessageCollector uiMidi;                 // notes from the on-screen keyboard
    void setParamFromUI (const juce::String& id, double v);
    void setModFromUI (int index, double v);
    void setAllModsFromUI (const juce::Array<juce::var>& values);
    void setPhraseFromUI (const juce::var& syllables, const juce::String& text);
    void sendCommand (int type, double a = 0, double b = 0);   // 1 panic, 2 phrase restart, 3 mod wheel
    juce::var getFullState() const;                     // params, matrix, words for the page
    float getModValue (int i) const { return mods[(size_t) i].load(); }

    // telemetry written by the audio thread, read by the editor
    std::array<std::atomic<float>, 24> tel {};
    std::atomic<float> peak { 0 };
    std::atomic<int> activeVoices { 0 };
    static constexpr int scopeSize = 4096;
    std::array<float, scopeSize> scope {};             // ring of recent output samples
    std::atomic<int> scopePos { 0 };
    std::atomic<double> currentSampleRate { 48000 };

private:
    static juce::AudioProcessorValueTreeState::ParameterLayout createLayout();
    static std::vector<vts::Syl> parseSyllables (const juce::var& syllables);
    static juce::String encodeSyllables (const std::vector<vts::Syl>&);
    static std::vector<vts::Syl> decodeSyllables (const juce::String&);

    vts::Synth synth;
    std::array<std::atomic<float>*, vts::NP> paramPtr {};
    std::array<double, vts::NP> lastParam {};
    std::array<std::atomic<float>, vts::NS * vts::ND> mods {};
    std::array<float, vts::NS * vts::ND> lastMods {};

    // words: built on the message thread, swapped into the engine on the audio thread
    juce::SpinLock phraseLock;
    std::vector<vts::Syl> pendingPhrase;
    std::atomic<bool> phrasePending { false };
    std::vector<vts::Syl> currentPhrase;               // copy for saving state
    juce::String phraseText;

    // small command queue from the editor
    struct Cmd { int type; double a, b; };
    juce::AbstractFifo cmdFifo { 64 };
    std::array<Cmd, 64> cmdBuf {};

    std::vector<float> tmpL, tmpR;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (VTSProcessor)
};
