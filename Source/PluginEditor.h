#pragma once
#include <JuceHeader.h>
#include "PluginProcessor.h"

// The plugin window: the same web interface as the browser version, talking to the processor.
class VTSEditor : public juce::AudioProcessorEditor, private juce::Timer
{
public:
    explicit VTSEditor (VTSProcessor&);
    ~VTSEditor() override;
    void resized() override;
    void paint (juce::Graphics& g) override { g.fillAll (juce::Colour (0xff0a1015)); }

private:
    void timerCallback() override;
    void handleMessage (const juce::var& msg);
    std::optional<juce::WebBrowserComponent::Resource> getResource (const juce::String& url);

    VTSProcessor& proc;
    std::unique_ptr<juce::WebBrowserComponent> web;
    bool pageReady = false;
    std::array<double, vts::NP> lastSent {};
    juce::dsp::FFT fft { 12 };
    juce::dsp::WindowingFunction<float> window { 4096, juce::dsp::WindowingFunction<float>::hann };
    std::array<float, 8192> fftBuf {};
    int tickCount = 0;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (VTSEditor)
};
