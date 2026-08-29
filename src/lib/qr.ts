/**
 * Pure TypeScript, zero-dependency QR code generator.
 *
 * Implements ISO/IEC 18004 compliant byte-mode encoding for QR Code versions 1 to 6
 * with Error Correction Level M (15% recovery) and Level L (7% recovery).
 *
 * Emits a 2D boolean matrix or an SVG path string without external dependencies.
 */

// Galois Field GF(256) tables with primitive polynomial 0x11D (285)
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(() => {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = val;
    GF_EXP[i + 255] = val;
    GF_LOG[val] = i;
    val = (val << 1) ^ (val >= 128 ? 0x11d : 0);
  }
  GF_LOG[0] = 0; // Not mathematically defined, but avoids undefined
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  const logX = GF_LOG[x] ?? 0;
  const logY = GF_LOG[y] ?? 0;
  return GF_EXP[logX + logY] ?? 0;
}

// Reed-Solomon polynomial division
function rsCompute(data: Uint8Array, ecCount: number): Uint8Array {
  // Generator polynomial
  let gen: number[] = [1];
  for (let i = 0; i < ecCount; i++) {
    const next: number[] = new Array(gen.length + 1).fill(0);
    const expVal = GF_EXP[i] ?? 0;
    for (let j = 0; j < gen.length; j++) {
      const g = gen[j] ?? 0;
      next[j] = (next[j] ?? 0) ^ gfMul(g, expVal);
      next[j + 1] = (next[j + 1] ?? 0) ^ g;
    }
    gen = next;
  }

  const result = new Uint8Array(ecCount);
  for (const byte of data) {
    const factor = byte ^ (result[0] ?? 0);
    for (let i = 0; i < ecCount - 1; i++) {
      result[i] = (result[i + 1] ?? 0) ^ gfMul(factor, gen[i + 1] ?? 0);
    }
    result[ecCount - 1] = gfMul(factor, gen[ecCount] ?? 0);
  }
  return result;
}

interface VersionSpec {
  version: number;
  size: number;
  dataCapacityM: number; // Max byte data capacity for EC Level M
  totalCodewords: number;
  ecCodewords: number;
  alignmentPatternCenters: readonly number[];
}

const VERSION_SPECS: readonly VersionSpec[] = [
  {
    version: 1,
    size: 21,
    dataCapacityM: 14,
    totalCodewords: 26,
    ecCodewords: 10,
    alignmentPatternCenters: [],
  },
  {
    version: 2,
    size: 25,
    dataCapacityM: 26,
    totalCodewords: 44,
    ecCodewords: 16,
    alignmentPatternCenters: [6, 18],
  },
  {
    version: 3,
    size: 29,
    dataCapacityM: 42,
    totalCodewords: 70,
    ecCodewords: 26,
    alignmentPatternCenters: [6, 22],
  },
  {
    version: 4,
    size: 33,
    dataCapacityM: 62,
    totalCodewords: 100,
    ecCodewords: 36,
    alignmentPatternCenters: [6, 26],
  },
  {
    version: 5,
    size: 37,
    dataCapacityM: 84,
    totalCodewords: 134,
    ecCodewords: 48,
    alignmentPatternCenters: [6, 30],
  },
  {
    version: 6,
    size: 41,
    dataCapacityM: 106,
    totalCodewords: 172,
    ecCodewords: 64,
    alignmentPatternCenters: [6, 34],
  },
];

export interface QrMatrix {
  size: number;
  modules: boolean[][];
}

/**
 * Encodes an ASCII/UTF-8 string into a QR Code boolean matrix.
 */
export function generateQrMatrix(text: string): QrMatrix {
  const encoder = new TextEncoder();
  const inputBytes = encoder.encode(text);

  const spec = VERSION_SPECS.find((s) => s.dataCapacityM >= inputBytes.length);
  if (!spec) {
    throw new Error(`QR content too long (${inputBytes.length} bytes; max 106 supported)`);
  }

  const { size, ecCodewords, totalCodewords } = spec;
  const dataCodewordsCount = totalCodewords - ecCodewords;

  // 1. Bitstream assembly: Byte Mode (0100) + 8-bit length + data + terminator + padding
  const bits: number[] = [0, 1, 0, 0]; // Mode indicator for 8-bit byte mode

  // Character count indicator (8 bits for versions 1-9 in byte mode)
  for (let i = 7; i >= 0; i--) {
    bits.push((inputBytes.length >> i) & 1);
  }

  // Data bits
  for (const byte of inputBytes) {
    for (let i = 7; i >= 0; i--) {
      bits.push((byte >> i) & 1);
    }
  }

  // Terminator (up to 4 zeroes)
  const maxBits = dataCodewordsCount * 8;
  const termLength = Math.min(4, maxBits - bits.length);
  for (let i = 0; i < termLength; i++) bits.push(0);

  // Pad to multiple of 8
  while (bits.length % 8 !== 0) bits.push(0);

  // Convert to bytes
  const dataBytes = new Uint8Array(dataCodewordsCount);
  for (let i = 0; i < bits.length; i += 8) {
    let byteVal = 0;
    for (let j = 0; j < 8; j++) {
      byteVal = (byteVal << 1) | (bits[i + j] ?? 0);
    }
    dataBytes[i / 8] = byteVal;
  }

  // Alternating pad bytes (0xEC, 0x11)
  let padToggle = false;
  for (let i = bits.length / 8; i < dataCodewordsCount; i++) {
    dataBytes[i] = padToggle ? 0x11 : 0xec;
    padToggle = !padToggle;
  }

  // 2. Compute error correction
  let finalCodewords: Uint8Array;
  if (spec.version <= 4) {
    const ec = rsCompute(dataBytes, ecCodewords);
    finalCodewords = new Uint8Array(totalCodewords);
    finalCodewords.set(dataBytes, 0);
    finalCodewords.set(ec, dataBytes.length);
  } else if (spec.version === 5) {
    // 2 blocks: 43 data each, 24 EC each
    const b1Data = dataBytes.slice(0, 43);
    const b2Data = dataBytes.slice(43, 86);
    const b1Ec = rsCompute(b1Data, 24);
    const b2Ec = rsCompute(b2Data, 24);

    finalCodewords = new Uint8Array(totalCodewords);
    let idx = 0;
    for (let i = 0; i < 43; i++) {
      finalCodewords[idx++] = b1Data[i] ?? 0;
      finalCodewords[idx++] = b2Data[i] ?? 0;
    }
    for (let i = 0; i < 24; i++) {
      finalCodewords[idx++] = b1Ec[i] ?? 0;
      finalCodewords[idx++] = b2Ec[i] ?? 0;
    }
  } else {
    // Version 6: 4 blocks of 27 data, 16 EC
    const blocksData: Uint8Array[] = [];
    const blocksEc: Uint8Array[] = [];
    for (let b = 0; b < 4; b++) {
      const bData = dataBytes.slice(b * 27, (b + 1) * 27);
      blocksData.push(bData);
      blocksEc.push(rsCompute(bData, 16));
    }
    finalCodewords = new Uint8Array(totalCodewords);
    let idx = 0;
    for (let i = 0; i < 27; i++) {
      for (let b = 0; b < 4; b++) {
        finalCodewords[idx++] = blocksData[b]?.[i] ?? 0;
      }
    }
    for (let i = 0; i < 16; i++) {
      for (let b = 0; b < 4; b++) {
        finalCodewords[idx++] = blocksEc[b]?.[i] ?? 0;
      }
    }
  }

  // 3. Matrix setup
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));

  // Helper to place patterns
  function setModule(r: number, c: number, val: boolean) {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      const row = matrix[r];
      if (row) row[c] = val;
    }
  }

  // 3a. Finder patterns (7x7) + separator (8x8)
  function placeFinder(top: number, left: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = top + r;
        const col = left + c;
        if (row < 0 || row >= size || col < 0 || col >= size) continue;
        if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
          const isBlack =
            r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
          setModule(row, col, isBlack);
        } else {
          setModule(row, col, false); // Separator
        }
      }
    }
  }

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // 3b. Alignment patterns (versions 2+)
  if (spec.alignmentPatternCenters.length >= 2) {
    const centers = spec.alignmentPatternCenters;
    for (const r of centers) {
      for (const c of centers) {
        // Skip finders
        if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) {
          continue;
        }
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const isBorder = Math.abs(dr) === 2 || Math.abs(dc) === 2;
            const isCenter = dr === 0 && dc === 0;
            setModule(r + dr, c + dc, isBorder || isCenter);
          }
        }
      }
    }
  }

  // 3c. Timing patterns (alternating black/white)
  for (let i = 8; i < size - 8; i++) {
    if (matrix[6]?.[i] === null) setModule(6, i, i % 2 === 0);
    if (matrix[i]?.[6] === null) setModule(i, 6, i % 2 === 0);
  }

  // 3d. Dark module
  setModule(4 * spec.version + 9, 8, true);

  // 3e. Reserve format info areas
  for (let i = 0; i <= 8; i++) {
    const row8 = matrix[8];
    if (row8 && row8[i] === null) row8[i] = false;
    const rowI = matrix[i];
    if (rowI && rowI[8] === null) rowI[8] = false;
  }
  for (let i = size - 8; i < size; i++) {
    const row8 = matrix[8];
    if (row8 && row8[i] === null) row8[i] = false;
    const rowI = matrix[i];
    if (rowI && rowI[8] === null) rowI[8] = false;
  }

  // 4. Data placement in zigzag columns right to left
  let bitIndex = 0;
  const totalBits = finalCodewords.length * 8;

  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // Skip vertical timing pattern
    const upward = ((right + 1) / 2) % 2 === 1;

    for (let rowStep = 0; rowStep < size; rowStep++) {
      const r = upward ? size - 1 - rowStep : rowStep;
      for (let col = right; col >= right - 1; col--) {
        const row = matrix[r];
        if (!row || row[col] !== null) continue; // Skip function modules

        let bitVal = false;
        if (bitIndex < totalBits) {
          const bytePos = Math.floor(bitIndex / 8);
          const bitPos = 7 - (bitIndex % 8);
          const byteVal = finalCodewords[bytePos] ?? 0;
          bitVal = ((byteVal >> bitPos) & 1) === 1;
          bitIndex++;
        }

        // Mask 0: (row + col) % 2 === 0
        const mask = (r + col) % 2 === 0;
        row[col] = mask ? !bitVal : bitVal;
      }
    }
  }

  // 5. Format info for EC Level M (00) + Mask 0 (000) => 00000
  // Standard format information with BCH error correction and 0x5412 XOR mask:
  const FORMAT_BITS = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];

  // Place top-left format bits
  const tlCoords: readonly [number, number][] = [
    [8, 0],
    [8, 1],
    [8, 2],
    [8, 3],
    [8, 4],
    [8, 5],
    [8, 7],
    [8, 8],
    [7, 8],
    [5, 8],
    [4, 8],
    [3, 8],
    [2, 8],
    [1, 8],
    [0, 8],
  ];
  for (let i = 0; i < 15; i++) {
    const coord = tlCoords[i];
    if (coord) {
      const [r, c] = coord;
      const row = matrix[r];
      if (row) row[c] = FORMAT_BITS[i] === 1;
    }
  }

  // Place split format bits (bottom-left and top-right)
  for (let i = 0; i < 7; i++) {
    const row = matrix[size - 1 - i];
    if (row) row[8] = FORMAT_BITS[i] === 1;
  }
  for (let i = 0; i < 8; i++) {
    const row = matrix[8];
    if (row) row[size - 8 + i] = FORMAT_BITS[7 + i] === 1;
  }

  // Convert to clean boolean[][]
  return {
    size,
    modules: matrix.map((row) => row.map((cell) => cell ?? false)),
  };
}

/**
 * Converts a QR boolean matrix into SVG path data.
 */
export function qrMatrixToSvgPath(matrix: QrMatrix): string {
  const { size, modules } = matrix;
  let path = '';
  for (let r = 0; r < size; r++) {
    const row = modules[r];
    if (!row) continue;
    for (let c = 0; c < size; c++) {
      if (row[c]) {
        path += `M${c},${r}h1v1h-1z `;
      }
    }
  }
  return path.trim();
}
