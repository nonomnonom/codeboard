# Studio types

Data shapes for studio. See [all type groups](../types.md) for other domains and shared units. Import public types from `codeboard-studio`; helper shapes are included to explain nested values.

## StudioContent

```ts
export interface StudioContent {
    componentOrigins?: import("./component-origins.js").ComponentOrigin[];
    palettes?: import("./palettes.js").Palette[];
    script?: ProductionScript;
    animations: ShotAnimation[];
    editorial: EditorialSequence[];
}
```
