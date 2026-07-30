/** Max width or height allowed for book cover images. */
export const MAX_IMAGE_EDGE = 600;

/** Prefer covers at or under this byte size (client may shrink further to meet it). */
export const TARGET_IMAGE_BYTES = 15_000;

/**
 * Client encode ladder: try largest edge first, then step down until the
 * chosen encoding fits {@link TARGET_IMAGE_BYTES} (or the floor is reached).
 */
export const IMAGE_EDGE_LADDER = [600, 500, 400, 300, 240, 180, 120] as const;

export type ImageSize = { width: number; height: number };

function readUInt32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset]! << 24) |
      (bytes[offset + 1]! << 16) |
      (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!) >>>
    0
  );
}

function readUInt16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function readUInt16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! << 8) | bytes[offset + 1]!;
}

function pngSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 24) return null;
  if (
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47 ||
    bytes[4] !== 0x0d ||
    bytes[5] !== 0x0a ||
    bytes[6] !== 0x1a ||
    bytes[7] !== 0x0a
  )
    return null;
  return { width: readUInt32BE(bytes, 16), height: readUInt32BE(bytes, 20) };
}

function gifSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 10) return null;
  if (bytes[0] !== 0x47 || bytes[1] !== 0x49 || bytes[2] !== 0x46) return null;
  return { width: readUInt16LE(bytes, 6), height: readUInt16LE(bytes, 8) };
}

function jpegSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1]!;
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = readUInt16BE(bytes, offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) return null;
    // SOF0 / SOF1 / SOF2
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return {
        height: readUInt16BE(bytes, offset + 5),
        width: readUInt16BE(bytes, offset + 7),
      };
    }
    offset += 2 + length;
  }
  return null;
}

function webpSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 30) return null;
  if (
    bytes[0] !== 0x52 ||
    bytes[1] !== 0x49 ||
    bytes[2] !== 0x46 ||
    bytes[3] !== 0x46 ||
    bytes[8] !== 0x57 ||
    bytes[9] !== 0x45 ||
    bytes[10] !== 0x42 ||
    bytes[11] !== 0x50
  )
    return null;
  const chunk = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!);
  if (chunk === "VP8X" && bytes.length >= 30) {
    const width = 1 + bytes[24]! + (bytes[25]! << 8) + (bytes[26]! << 16);
    const height = 1 + bytes[27]! + (bytes[28]! << 8) + (bytes[29]! << 16);
    return { width, height };
  }
  if (chunk === "VP8 " && bytes.length >= 30) {
    return {
      width: readUInt16LE(bytes, 26) & 0x3fff,
      height: readUInt16LE(bytes, 28) & 0x3fff,
    };
  }
  if (chunk === "VP8L" && bytes.length >= 25) {
    const bits = bytes[21]! | (bytes[22]! << 8) | (bytes[23]! << 16) | (bytes[24]! << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

function readFourCC(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset]!,
    bytes[offset + 1]!,
    bytes[offset + 2]!,
    bytes[offset + 3]!,
  );
}

function isAvifFtyp(bytes: Uint8Array): boolean {
  if (bytes.length < 12 || readFourCC(bytes, 4) !== "ftyp") return false;
  const size = readUInt32BE(bytes, 0);
  const end = size === 0 ? bytes.length : Math.min(bytes.length, size);
  for (let offset = 8; offset + 4 <= end; offset += 4) {
    if (offset === 12) continue; // minor_version
    const brand = readFourCC(bytes, offset);
    if (brand === "avif" || brand === "avis" || brand === "MA1B" || brand === "MA1A") return true;
  }
  return false;
}

/** Walk ISO-BMFF boxes; AVIF stores width/height in an `ispe` fullbox. */
function findIspeSize(bytes: Uint8Array, start: number, end: number): ImageSize | null {
  let offset = start;
  while (offset + 8 <= end) {
    const sizeField = readUInt32BE(bytes, offset);
    const type = readFourCC(bytes, offset + 4);
    let header = 8;
    let boxEnd: number;
    if (sizeField === 1) {
      if (offset + 16 > end) return null;
      const large =
        readUInt32BE(bytes, offset + 8) * 0x100000000 + readUInt32BE(bytes, offset + 12);
      header = 16;
      boxEnd = offset + large;
    } else if (sizeField === 0) {
      boxEnd = end;
    } else {
      boxEnd = offset + sizeField;
    }
    if (boxEnd > end || boxEnd < offset + header) return null;

    if (type === "ispe" && offset + header + 12 <= boxEnd) {
      // FullBox: version(1) + flags(3), then width/height uint32
      return {
        width: readUInt32BE(bytes, offset + header + 4),
        height: readUInt32BE(bytes, offset + header + 8),
      };
    }

    // Containers that may nest ispe (meta/iref are FullBoxes)
    const nestedStart = type === "meta" || type === "iref" ? offset + header + 4 : offset + header;
    if (
      type === "meta" ||
      type === "iprp" ||
      type === "ipco" ||
      type === "moov" ||
      type === "mdia" ||
      type === "minf"
    ) {
      const found = findIspeSize(bytes, nestedStart, boxEnd);
      if (found) return found;
    }

    offset = boxEnd;
  }
  return null;
}

function avifSize(bytes: Uint8Array): ImageSize | null {
  if (!isAvifFtyp(bytes)) return null;
  return findIspeSize(bytes, 0, bytes.length);
}

export function getImageDimensions(bytes: Uint8Array): ImageSize | null {
  return pngSize(bytes) ?? jpegSize(bytes) ?? gifSize(bytes) ?? webpSize(bytes) ?? avifSize(bytes);
}

/** Scale down so neither edge exceeds `maxEdge`, preserving aspect ratio. */
export function fitImageSize(
  width: number,
  height: number,
  maxEdge: number = MAX_IMAGE_EDGE,
): ImageSize {
  if (width <= maxEdge && height <= maxEdge) return { width, height };
  const scale = Math.min(maxEdge / width, maxEdge / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function validateImageEdge(
  bytes: Uint8Array,
): { ok: true; size: ImageSize } | { ok: false; error: string } {
  const size = getImageDimensions(bytes);
  if (!size) return { ok: false, error: "Could not read image dimensions" };
  if (size.width > MAX_IMAGE_EDGE || size.height > MAX_IMAGE_EDGE) {
    return {
      ok: false,
      error: `Image must be at most ${MAX_IMAGE_EDGE}×${MAX_IMAGE_EDGE} pixels (got ${size.width}×${size.height})`,
    };
  }
  if (size.width < 1 || size.height < 1) return { ok: false, error: "Invalid image dimensions" };
  return { ok: true, size };
}
