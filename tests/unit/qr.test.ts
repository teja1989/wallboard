import { describe, expect, it } from 'vitest';
import { generateQrMatrix, qrMatrixToSvgPath } from '@/lib/qr';

describe('QR code generator', () => {
  it('generates a valid Version 1 matrix for short text', () => {
    const matrix = generateQrMatrix('HELLO');
    expect(matrix.size).toBe(21);
    expect(matrix.modules.length).toBe(21);
    expect(matrix.modules[0]?.length).toBe(21);

    // Top-left finder pattern check
    // Row 0 has 7 dark modules: (0,0) to (0,6)
    for (let c = 0; c < 7; c++) {
      expect(matrix.modules[0]?.[c]).toBe(true);
      expect(matrix.modules[6]?.[c]).toBe(true);
    }
  });

  it('generates appropriate versions for longer invitation URLs', () => {
    const url = 'https://marqueersvp.com/i/A1B2C3D4';
    const matrix = generateQrMatrix(url);
    // 34 bytes fits in Version 3 (29x29)
    expect(matrix.size).toBe(29);
    expect(matrix.modules.length).toBe(29);

    const pathWithoutMargin = qrMatrixToSvgPath(matrix, 0);
    expect(pathWithoutMargin).toContain('M0,0h1v1h-1z');

    const pathWithMargin = qrMatrixToSvgPath(matrix, 4);
    expect(pathWithMargin).toContain('M4,4h1v1h-1z');
    expect(pathWithMargin.length).toBeGreaterThan(100);
  });

  it('handles long text payloads by scaling QR version automatically', () => {
    const longText =
      'https://marqueersvp.com/i/very-long-test-invitation-path-with-extra-payload-query-params';
    const matrix = generateQrMatrix(longText);
    expect(matrix.size).toBeGreaterThan(29);
    expect(matrix.modules.length).toBe(matrix.size);
  });
});
