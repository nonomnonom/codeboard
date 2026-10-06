# Characters types

Data shapes for characters. See [all type groups](../types.md) for other domains and shared units. Import public types from `codeboard-studio`; helper shapes are included to explain nested values.

## CharacterInstanceOptions

```ts
export interface CharacterInstanceOptions {
    id: string;
    targetAnimationId: string;
    rootLayerId: string;
    name?: string;
    parentLayerId?: string;
    /** Required when the destination has a composite graph; identifies its receiving source node. */
    compositeSourceId?: string;
    frameOffset?: number;
    /** Additional placement around the copied character; source pose keys stay intact. */
    transform?: Partial<Transform>;
}
```

## CharacterInstanceResult

```ts
export interface CharacterInstanceResult {
    instanceId: string;
    sourceAnimationId: string;
    targetAnimationId: string;
    sourceRootLayerId: string;
    identities: {
        sourceId: string;
        copyId: string;
    }[];
}
```
