# Runtime types

Data shapes for runtime. See [all type groups](../types.md) for other domains and shared units. Import public types from `codeboard-studio`; helper shapes are included to explain nested values.

## CapabilityReport

```ts
export interface CapabilityReport {
    format: "codeboard-capabilities/1";
    runtime: {
        package: string;
        version: string;
        node: string;
        platform: string;
    };
    projectSchemaVersion: number;
    containerFormatVersion: number;
    features: CapabilityEntry[];
    editCommands: string[];
    dependencies: {
        ffmpeg: DependencyAvailability;
        ffprobe: DependencyAvailability;
    };
    formats: {
        project: string[];
        image: string[];
        delivery: string[];
    };
}
```

## CapabilityEntry

```ts
export interface CapabilityEntry {
    id: string;
    status: "supported" | "partial" | "unavailable";
    operations: string[];
    constraints: string[];
}
```

## DependencyAvailability

```ts
export interface DependencyAvailability {
    status: "unchecked" | "available" | "unavailable";
    version?: string;
    reason?: string;
}
```
