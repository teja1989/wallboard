import qrcode from 'qrcode-generator';

export interface QrMatrix {
  size: number;
  modules: boolean[][];
}

/**
 * Generates an ISO/IEC 18004 compliant QR Code boolean matrix using Error Correction Level M.
 */
export function generateQrMatrix(text: string): QrMatrix {
  // Type 0 = auto-select smallest version (1-40) to fit data
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();

  const size = qr.getModuleCount();
  const modules: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) {
      row.push(qr.isDark(r, c));
    }
    modules.push(row);
  }

  return { size, modules };
}

/**
 * Converts a QR boolean matrix into SVG path data with a quiet-zone margin (default 4 modules per ISO/IEC 18004).
 */
export function qrMatrixToSvgPath(matrix: QrMatrix, margin = 4): string {
  const { size, modules } = matrix;
  let path = '';
  for (let r = 0; r < size; r++) {
    const row = modules[r];
    if (!row) continue;
    for (let c = 0; c < size; c++) {
      if (row[c]) {
        path += `M${c + margin},${r + margin}h1v1h-1z `;
      }
    }
  }
  return path.trim();
}
