export type SupportedImageFormat = {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
};

const MAX_IMAGE_PIXELS = 40_000_000;

function safeDimensions(width: number, height: number) {
  return Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0
    && width <= 20_000 && height <= 20_000 && width * height <= MAX_IMAGE_PIXELS;
}

function validJpeg(buffer: Buffer) {
  if (buffer.length < 12 || buffer[0] !== 0xff || buffer[1] !== 0xd8
    || buffer[buffer.length - 2] !== 0xff || buffer[buffer.length - 1] !== 0xd9) return false;
  const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  let dimensionsFound = false;
  while (offset + 4 <= buffer.length - 2) {
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset++];
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) return false;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) return false;
    if (marker === 0xda) return dimensionsFound && offset + length <= buffer.length - 2;
    if (startOfFrame.has(marker)) {
      if (length < 7) return false;
      dimensionsFound = safeDimensions(buffer.readUInt16BE(offset + 3), buffer.readUInt16BE(offset + 5));
      if (!dimensionsFound) return false;
    }
    offset += length;
  }
  return false;
}

function validPng(buffer: Buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 45 || !buffer.subarray(0, 8).equals(signature)
    || buffer.readUInt32BE(8) !== 13 || buffer.subarray(12, 16).toString("ascii") !== "IHDR"
    || !safeDimensions(buffer.readUInt32BE(16), buffer.readUInt32BE(20))) return false;
  let offset = 8;
  let sawImageData = false;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > buffer.length) return false;
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    if (type === "IDAT") sawImageData = true;
    if (type === "IEND") return length === 0 && sawImageData && end === buffer.length;
    offset = end;
  }
  return false;
}

function validWebp(buffer: Buffer) {
  if (buffer.length < 30 || buffer.subarray(0, 4).toString("ascii") !== "RIFF"
    || buffer.subarray(8, 12).toString("ascii") !== "WEBP"
    || buffer.readUInt32LE(4) + 8 !== buffer.length) return false;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.subarray(offset, offset + 4).toString("ascii");
    const length = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (data + length > buffer.length) return false;
    if (type === "VP8X" && length >= 10) {
      const width = 1 + buffer[data + 4] + (buffer[data + 5] << 8) + (buffer[data + 6] << 16);
      const height = 1 + buffer[data + 7] + (buffer[data + 8] << 8) + (buffer[data + 9] << 16);
      return safeDimensions(width, height);
    }
    if (type === "VP8L" && length >= 5 && buffer[data] === 0x2f) {
      const bits = buffer.readUInt32LE(data + 1);
      return safeDimensions((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1);
    }
    if (type === "VP8 " && length >= 10
      && buffer[data + 3] === 0x9d && buffer[data + 4] === 0x01 && buffer[data + 5] === 0x2a) {
      return safeDimensions(buffer.readUInt16LE(data + 6) & 0x3fff, buffer.readUInt16LE(data + 8) & 0x3fff);
    }
    offset = data + length + (length % 2);
  }
  return false;
}

export function detectSupportedImageFormat(buffer: Buffer): SupportedImageFormat | null {
  if (validJpeg(buffer)) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }

  if (validPng(buffer)) {
    return { contentType: "image/png", extension: "png" };
  }

  if (validWebp(buffer)) {
    return { contentType: "image/webp", extension: "webp" };
  }

  return null;
}
