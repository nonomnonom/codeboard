# Component origins types

Data shapes for component origins. See [all type groups](../types.md) for other domains and shared units. Import public types from `codeboard-studio`; helper shapes are included to explain nested values.

## ComponentOrigin

```ts
export interface ComponentOrigin {
    instanceId: string;
    componentId: string;
    version: number;
    source: Layer[];
    identities: {
        sourceId: string;
        copyId: string;
    }[];
    sha256: string;
}
```
