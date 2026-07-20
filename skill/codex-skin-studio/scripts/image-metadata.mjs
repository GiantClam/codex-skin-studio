const PNG_SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

export const IMAGE_LIMITS = Object.freeze({
  maxBytes: 8 * 1024 * 1024,
  maxWidth: 8192,
  maxHeight: 8192,
  maxPixels: 32_000_000,
  maxAspectRatio: 100,
});

function bytesOf(input) {
  if (input instanceof Uint8Array) return input;
  throw new TypeError("image input must be a Uint8Array or Buffer");
}

function ascii(bytes, offset, length) {
  if (offset < 0 || length < 0 || offset + length > bytes.length) throw new RangeError("image header is truncated");
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function matches(bytes, offset, expected) {
  return offset + expected.length <= bytes.length && expected.every((value, index) => bytes[offset + index] === value);
}

function uint16be(bytes, offset) {
  if (offset + 2 > bytes.length) throw new RangeError("image header is truncated");
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function uint16le(bytes, offset) {
  if (offset + 2 > bytes.length) throw new RangeError("image header is truncated");
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function uint24le(bytes, offset) {
  if (offset + 3 > bytes.length) throw new RangeError("image header is truncated");
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function uint32be(bytes, offset) {
  if (offset + 4 > bytes.length) throw new RangeError("image header is truncated");
  return (bytes[offset] * 0x1000000) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
}

function uint32le(bytes, offset) {
  if (offset + 4 > bytes.length) throw new RangeError("image header is truncated");
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] * 0x1000000)) >>> 0;
}

function dimensions(mime, width, height, format) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new RangeError(`${format} dimensions are invalid`);
  return { mime, width, height };
}

function parsePng(bytes) {
  if (bytes.length < 24 || uint32be(bytes, 8) !== 13 || ascii(bytes, 12, 4) !== "IHDR") throw new TypeError("PNG does not contain a valid IHDR header");
  return dimensions("image/png", uint32be(bytes, 16), uint32be(bytes, 20), "PNG");
}

function parseJpeg(bytes) {
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset++] !== 0xff) throw new TypeError("JPEG marker header is invalid");
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) throw new RangeError("JPEG header is truncated");
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = uint16be(bytes, offset);
    if (length < 2 || offset + length > bytes.length) throw new RangeError("JPEG segment header is truncated");
    if (JPEG_SOF_MARKERS.has(marker)) {
      if (length < 7) throw new RangeError("JPEG SOF header is truncated");
      return dimensions("image/jpeg", uint16be(bytes, offset + 5), uint16be(bytes, offset + 3), "JPEG");
    }
    offset += length;
  }
  throw new TypeError("JPEG does not contain a supported SOF header");
}

function parseWebp(bytes) {
  if (bytes.length < 20 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") throw new TypeError("WebP RIFF header is invalid");
  const riffEnd = uint32le(bytes, 4) + 8;
  if (riffEnd < 20 || riffEnd > bytes.length) throw new RangeError("WebP RIFF header is truncated");
  let offset = 12;
  while (offset + 8 <= riffEnd) {
    const chunk = ascii(bytes, offset, 4);
    const length = uint32le(bytes, offset + 4);
    const data = offset + 8;
    const end = data + length;
    if (end > riffEnd) throw new RangeError("WebP chunk header is truncated");
    if (chunk === "VP8X") {
      if (length < 10) throw new RangeError("WebP VP8X header is truncated");
      return dimensions("image/webp", uint24le(bytes, data + 4) + 1, uint24le(bytes, data + 7) + 1, "WebP");
    }
    if (chunk === "VP8L") {
      if (length < 5 || bytes[data] !== 0x2f) throw new TypeError("WebP VP8L header is invalid");
      const first = bytes[data + 1];
      const second = bytes[data + 2];
      const third = bytes[data + 3];
      const fourth = bytes[data + 4];
      return dimensions("image/webp", 1 + first + ((second & 0x3f) << 8), 1 + ((second >> 6) & 0x03) + (third << 2) + ((fourth & 0x0f) << 10), "WebP");
    }
    if (chunk === "VP8 ") {
      if (length < 10 || bytes[data + 3] !== 0x9d || bytes[data + 4] !== 0x01 || bytes[data + 5] !== 0x2a) throw new TypeError("WebP VP8 header is invalid");
      return dimensions("image/webp", uint16le(bytes, data + 6) & 0x3fff, uint16le(bytes, data + 8) & 0x3fff, "WebP");
    }
    offset = end + (length & 1);
  }
  throw new TypeError("WebP does not contain a supported dimension header");
}

export function parseImageMetadata(input) {
  const bytes = bytesOf(input);
  if (matches(bytes, 0, PNG_SIGNATURE)) return parsePng(bytes);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return parseJpeg(bytes);
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF") return parseWebp(bytes);
  throw new TypeError("unsupported or unrecognized image header");
}

export function validateImageMetadata(input, { expectedMime, limits = IMAGE_LIMITS } = {}) {
  const bytes = bytesOf(input);
  if (bytes.length < 1 || bytes.length > limits.maxBytes) throw new RangeError(`image must be between 1 and ${limits.maxBytes} bytes`);
  const metadata = parseImageMetadata(bytes);
  if (expectedMime && metadata.mime !== expectedMime) throw new TypeError(`image MIME does not match extension: expected ${expectedMime}, got ${metadata.mime}`);
  if (metadata.width > limits.maxWidth || metadata.height > limits.maxHeight) throw new RangeError(`image dimensions exceed ${limits.maxWidth}x${limits.maxHeight}`);
  if (metadata.width > Math.floor(limits.maxPixels / metadata.height)) throw new RangeError(`image pixel count exceeds ${limits.maxPixels}`);
  const shorter = Math.min(metadata.width, metadata.height);
  const longer = Math.max(metadata.width, metadata.height);
  if (longer > shorter * limits.maxAspectRatio) throw new RangeError(`image aspect ratio exceeds ${limits.maxAspectRatio}:1`);
  return metadata;
}
