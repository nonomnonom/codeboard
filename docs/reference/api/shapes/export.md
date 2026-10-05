# Export types

Data shapes for export. See [all type groups](../types.md) for other domains and shared units. Import public types from `codeboard-studio`; helper shapes are included to explain nested values.

## ReviewTarget

```ts
export type ReviewTarget = {
    kind: "board";
} | {
    kind: "shot";
    animationId: string;
} | {
    kind: "editorial";
    sequenceId: string;
};
```

## ReviewFrameSource

```ts
export type ReviewFrameSource = {
    kind: "board";
    panelId: string;
    incomingPanelId?: string;
    transitionProgress: number;
} | {
    kind: "shot";
    animationId: string;
    sourceFrame: number;
} | {
    kind: "editorial";
    sequenceId: string;
    outgoing: {
        clipId: string;
        animationId: string;
        sourceFrame: number;
    };
    incoming?: {
        clipId: string;
        animationId: string;
        sourceFrame: number;
    };
    transition: Transition["type"];
    transitionProgress: number;
};
```

## ReviewExportOptions

```ts
export interface ReviewExportOptions {
    target?: ReviewTarget;
    frames: number[];
    expectedVersion: number;
    revision?: string;
    annotations?: boolean;
    signal?: AbortSignal;
}
```

## ReviewManifest

```ts
export interface ReviewManifest {
    format: "codeboard-review/2";
    createdAt: string;
    source: {
        projectId: string;
        version: number;
        schemaVersion: number;
        documentHash: string;
        revision?: string;
    };
    renderer: {
        package: string;
        version: string;
        node: string;
        platform: string;
    };
    settings: {
        target: ReviewTarget;
        annotations: boolean;
        frameRate: RationalRate;
        space: "camera";
        imageFormat: "PNG";
    };
    frames: {
        frame: number;
        file: string;
        sha256: string;
        bytes: number;
        width: number;
        height: number;
        source: ReviewFrameSource;
    }[];
}
```

## ProjectPublishManifest

```ts
export interface ProjectPublishManifest {
    format: "codeboard-project-publish/1";
    source: {
        projectId: string;
        version: number;
        documentHash: string;
    };
    file: {
        name: "project.cboard";
        bytes: number;
        sha256: string;
    };
    engine: RenderIdentity;
    externalFonts: string[];
    fontFiles?: FontFileDependency[];
}
```

## MovieOptions

```ts
export interface MovieOptions extends MovieEncodingOptions {
    fontPolicy?: FontPolicy;
    assetRoot?: string;
}
```

## StudioMovieOptions

```ts
export interface StudioMovieOptions extends MovieEncodingOptions {
    fontPolicy?: FontPolicy;
    range?: {
        startFrame: number;
        endFrame: number;
    };
    audio?: "omit" | {
        mode: "mix";
        decoder: StudioAudioDecoder;
        transitions: "sum" | "linear";
        maxSamples?: number;
        rounding?: AudioSampleRounding;
    };
}
```

## AudioStemTarget

```ts
export type AudioStemTarget = {
    kind: "shot";
    animation: ShotAnimation;
} | {
    kind: "editorial";
    sequence: EditorialSequence;
    animations: readonly ShotAnimation[];
};
```

## AudioStemExportOptions

```ts
export interface AudioStemExportOptions {
    stems: readonly {
        name: string;
        tracks: readonly AudioTrackRef[];
    }[];
    transitions: "sum" | "linear";
    sampleFormat?: "pcm16" | "float32";
    mix?: Omit<AudioMixOptions, "tracks">;
}
```

## AudioStemManifest

```ts
export interface AudioStemManifest {
    format: "codeboard-audio-stems/1";
    source: {
        kind: "shot" | "editorial";
        id: string;
        fingerprint: string;
    };
    sampleRate: number;
    sampleFormat: "pcm16" | "float32";
    transitions: "sum" | "linear";
    range: {
        startSample: number;
        endSample: number;
    };
    stems: {
        name: string;
        tracks: AudioTrackRef[];
        file: string;
        sha256: string;
        bytes: number;
        samples: number;
        peak: number;
        clippedSamples: number;
    }[];
}
```

## FrameJobOptions

```ts
export interface FrameJobOptions {
    expectedVersion: number;
    target: FrameJobManifest["target"];
    range?: {
        startFrame: number;
        endFrame: number;
    };
    maxBytes?: number;
    fontPolicy?: "allow-fallback" | "require-available";
    outputProfile?: FrameJobManifest["outputProfile"];
    fontFiles?: FrameJobManifest["fontFiles"];
}
```

## RunFrameJobOptions

```ts
export interface RunFrameJobOptions {
    sourcePath?: string;
    range?: {
        startFrame: number;
        endFrame: number;
    };
    signal?: AbortSignal;
    onProgress?: (completed: number, total: number) => void;
}
```

## FrameJobMovieOptions

```ts
export interface FrameJobMovieOptions extends Omit<StudioMovieOptions, "range"> {
    sourcePath?: string;
}
```

## VerifyFrameJobOptions

```ts
export interface VerifyFrameJobOptions {
    signal?: AbortSignal;
    onProgress?: (visited: number, total: number) => void;
}
```

## FrameOutputProfile

```ts
export type FrameOutputProfile = {
    width: number;
    height: number;
    fit: "contain" | "cover" | "fill";
} & ({
    alpha: "preserve";
} | {
    alpha: "flatten";
    background: {
        r: number;
        g: number;
        b: number;
    };
});
```

## FrameJobFontFile

```ts
export type FrameJobFontFile = FontFileDependency;
```

## FrameJobManifest

```ts
export interface FrameJobManifest {
    format: "codeboard-frame-job/1";
    source: {
        path: string;
        projectId: string;
        version: number;
        documentHash: string;
    };
    target: {
        kind: "shot";
        animationId: string;
        render?: ShotRenderOptions;
    } | {
        kind: "editorial";
        sequenceId: string;
    };
    range: {
        startFrame: number;
        endFrame: number;
    };
    frameRate: {
        numerator: number;
        denominator: number;
    };
    renderer: RenderIdentity;
    maxBytes: number;
    fontPolicy?: "allow-fallback" | "require-available";
    outputProfile?: FrameOutputProfile;
    fontFiles?: FrameJobFontFile[];
}
```

## MovieEncodingOptions

```ts
export interface MovieEncodingOptions {
    ffmpegPath?: string;
    maxFrames?: number;
    signal?: AbortSignal;
    onProgress?: (completed: number, total: number) => void;
}
```

## ReviewDecisionInput

```ts
export interface ReviewDecisionInput {
    id: string;
    reviewer: {
        id: string;
        kind: "human" | "agent";
    };
    outcome: "approved" | "changes-requested" | "not-reviewed";
    criteria: string[];
    frames: number[];
    notes: string;
}
```

## ReviewDecision

```ts
export interface ReviewDecision extends ReviewDecisionInput {
    format: "codeboard-review-decision/1";
    createdAt: string;
    evidence: {
        manifestSha256: string;
        projectId: string;
        version: number;
        documentHash: string;
        target: ReviewTarget;
    };
    sha256: string;
}
```

## ReviewDecisionVerifyOptions

```ts
export interface ReviewDecisionVerifyOptions {
    decode?: boolean;
    signal?: AbortSignal;
    source?: {
        projectPath: string;
        revision?: string;
    };
}
```

## VerifyFrameSequenceOptions

```ts
export interface VerifyFrameSequenceOptions {
    decode?: boolean;
    signal?: AbortSignal;
    onProgress?: (verified: number, total: number) => void;
}
```

## FrameJobSequenceOptions

```ts
export interface FrameJobSequenceOptions {
    maxFrames?: number;
    signal?: AbortSignal;
    onProgress?: (completed: number, total: number) => void;
}
```

## PublishProjectOptions

```ts
export interface PublishProjectOptions extends CopyProjectOptions {
    fontFiles?: FontFileDependency[];
}
```
