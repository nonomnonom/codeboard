import { CodeboardError } from "../errors.js";
import type { PixelBuffer, PixelRegion, PixelSelection } from "../types.js";

export function validateDimensions(width: number, height: number): void {
  const maxPixels = 32 * 1024 * 1024;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Pixel surface dimensions must be positive safe integers",
      {
        details: { reason: "INVALID_SURFACE_DIMENSIONS", width, height, maxPixels },
      },
    );
  if (width * height > maxPixels)
    throw new CodeboardError(
      "RESOURCE_LIMIT",
      "Pixel surface exceeds the 32 megapixel render budget",
      {
        details: { reason: "SURFACE_PIXEL_LIMIT", width, height, maxPixels },
      },
    );
}

export function validatePixels(image: PixelBuffer): void {
  validateDimensions(image.width, image.height);
  if (
    !(image.pixels instanceof Uint8Array) ||
    image.pixels.length !== image.width * image.height * 4
  )
    throw new Error("Pixel surface requires exactly width × height × 4 RGBA8 bytes");
}

export function validatePixelRegion(image: PixelBuffer, region: PixelRegion): void {
  validatePixels(image);
  if (
    ![region.x, region.y, region.width, region.height].every(Number.isSafeInteger) ||
    region.x < 0 ||
    region.y < 0 ||
    region.width < 1 ||
    region.height < 1 ||
    region.x + region.width > image.width ||
    region.y + region.height > image.height
  )
    throw new Error("Pixel region must be an integer rectangle inside the source surface");
}

export function validateSelection(
  selection: PixelSelection,
  width = selection.width,
  height = selection.height,
): void {
  validateDimensions(selection.width, selection.height);
  if (
    selection.width !== width ||
    selection.height !== height ||
    !(selection.coverage instanceof Uint8Array) ||
    selection.coverage.length !== width * height
  )
    throw new Error(
      "Selection must contain one coverage byte per source pixel with matching dimensions",
    );
}
