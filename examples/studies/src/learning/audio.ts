import type { Chapter } from "./types.ts";

export const audio: Chapter = {
  id: "audio",
  title: "Place and hear sound",
  introduction:
    "Start with the timeline diagram, then listen to the generated clips. Waveforms help locate sound; listening reveals the result.",
  lessons: [
    {
      id: "audio-placement",
      title: "Choose the sound, then place it",
      question: "What is the difference between trimming and moving audio?",
      observe:
        "The source bar selects seconds 1 to 4. The project bar places that selection at seconds 2 to 5.",
      takeaway:
        "Trimming chooses which part of the recording you hear. Placement chooses when you hear it. This diagram itself is silent.",
      experiment: "Move the project start one second later without changing the source trim.",
      source: "audio/audio-placement.ts",
    },
    {
      id: "audio-delivery",
      title: "Hear the cue inside the silence",
      question: "Does the exported sound start and stop where you placed it?",
      observe:
        "Play the two-second clip. Listen for the tone between 0.5 and 1 second, and compare that interval with the waveform.",
      takeaway:
        "The waveform comes from decoded mixed audio. The clip contains a generated tone, not speech.",
      experiment:
        "Move the cue later or extend its fade. Listen again before inspecting the measurements.",
      source: "audio/audio-delivery.ts",
    },
    {
      id: "asset-replacement",
      title: "Replace a low tone with a high tone",
      question: "Will reopening the project play the replacement sound?",
      observe:
        "Compare the waves over the same time interval: the higher tone has more cycles. Play the replacement clip to hear it.",
      takeaway:
        "Replacing an audio asset changes the embedded sound used by the project. The technical checks also cover a missing replacement file.",
      experiment:
        "Change the replacement from 880 Hz to 440 Hz. Listen for the lower pitch and compare the waveform spacing.",
      source: "audio/asset-replacement.ts",
    },
  ],
};
