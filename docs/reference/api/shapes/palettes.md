# Palettes types

Data shapes for palettes. See [all type groups](../types.md) for other domains and shared units. Import public types from `codeboard-studio`; helper shapes are included to explain nested values.

## ColorChannel

```ts
export type ColorChannel = "color" | "fill" | "stroke";
```

## ColorBinding

```ts
export interface ColorBinding {
    swatchId: string;
    override?: string | undefined;
}
```

## PaletteSwatch

```ts
export interface PaletteSwatch {
    id: string;
    name: string;
    color: string;
}
```

## Palette

```ts
export interface Palette {
    id: string;
    name: string;
    swatches: PaletteSwatch[];
}
```

## PaletteBindingUsage

```ts
export interface PaletteBindingUsage {
    ownerKind: "panel" | "component" | "animation";
    ownerId: string;
    layerId: string;
    elementId: string;
    channel: ColorChannel;
    swatchId: string;
    override?: string;
}
```
