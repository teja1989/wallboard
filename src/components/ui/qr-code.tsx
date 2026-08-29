'use client';
import { useMemo } from 'react';
import { generateQrMatrix, qrMatrixToSvgPath } from '@/lib/qr';
import { cn } from '@/lib/utils';

interface QrCodeProps {
  value: string;
  size?: number;
  className?: string;
  fgColor?: string;
  bgColor?: string;
}

export function QrCode({
  value,
  size = 180,
  className,
  fgColor = 'currentColor',
  bgColor = 'transparent',
}: QrCodeProps) {
  const { matrixSize, path } = useMemo(() => {
    try {
      const matrix = generateQrMatrix(value);
      return {
        matrixSize: matrix.size,
        path: qrMatrixToSvgPath(matrix),
      };
    } catch {
      return { matrixSize: 21, path: '' };
    }
  }, [value]);

  if (!path) return null;

  // Margin of 2 modules around the QR code
  const margin = 2;
  const viewBoxSize = matrixSize + margin * 2;

  return (
    <svg
      role="img"
      aria-label="QR Code"
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      width={size}
      height={size}
      className={cn('shrink-0 select-none', className)}
    >
      {bgColor !== 'transparent' && (
        <rect width={viewBoxSize} height={viewBoxSize} fill={bgColor} rx={1} />
      )}
      <g transform={`translate(${margin}, ${margin})`}>
        <path d={path} fill={fgColor} />
      </g>
    </svg>
  );
}
