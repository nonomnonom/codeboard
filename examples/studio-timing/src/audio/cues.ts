import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createToneWav, type StoryboardProject } from "codeboard-studio";

export async function authorCues(
  project: StoryboardProject,
  directory: string,
  animations: string[],
) {
  for (const [index, animationId] of animations.entries()) {
    const file = `cue-${index}.wav`;
    await writeFile(
      join(directory, file),
      createToneWav({ frequency: index === 0 ? 440 : 660, durationSeconds: 1, volume: 0.2 }),
      { flag: "wx" },
    );
    const assetId = project.production.addAsset({
      id: `cue-${index}`,
      name: file,
      kind: "audio",
      path: file,
      source: "linked",
      mimeType: "audio/wav",
    });
    project.setStudioAudio(animationId, [
      {
        id: `track-${index}`,
        name: "Timing cue",
        muted: false,
        clips: [
          {
            id: `clip-cue-${index}`,
            assetId,
            name: "One second tone",
            start: { ticks: 12, rate: { numerator: 24, denominator: 1 } },
            source: { sampleRate: 48000, startSample: 0, sampleCount: 48000 },
            volume: 1,
            fadeInSamples: 240,
            fadeOutSamples: 240,
          },
        ],
      },
    ]);
  }
}
