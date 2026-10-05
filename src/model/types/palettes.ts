export type ColorChannel = "color" | "fill" | "stroke";

export interface ColorBinding {
  swatchId: string;
  override?: string | undefined;
}

export interface PaletteSwatch {
  id: string;
  name: string;
  color: string;
}

export interface Palette {
  id: string;
  name: string;
  swatches: PaletteSwatch[];
}

export interface PaletteBindingUsage {
  ownerKind: "panel" | "component" | "animation";
  ownerId: string;
  layerId: string;
  elementId: string;
  channel: ColorChannel;
  swatchId: string;
  override?: string;
}
