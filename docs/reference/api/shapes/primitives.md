# Primitives types

Data shapes for primitives. See [all type groups](../types.md) for other domains and shared units. Import public types from `codeboard-studio`; helper shapes are included to explain nested values.

## Id

```ts
export type Id = string;
```

## AffineMatrix

```ts
export type AffineMatrix = [
    number,
    number,
    number,
    number,
    number,
    number
];
```

## Point

```ts
export interface Point {
    x: number;
    y: number;
    pressure?: number;
    time?: number;
    tiltX?: number;
    tiltY?: number;
    rotation?: number;
}
```

## Transform

```ts
export interface Transform {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
}
```

## Pivot

```ts
export interface Pivot {
    x: number;
    y: number;
}
```

## BlendMode

```ts
export type BlendMode = "source-over" | "multiply" | "screen" | "overlay" | "darken" | "lighten";
```
