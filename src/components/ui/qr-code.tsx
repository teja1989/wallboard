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
  margin?: number;
}

export function QrCode({
  value,
  size = 180,
  className,
  fgColor = '#000000',
  bgColor = '#ffffff',
  margin = 4,
}: QrCodeProps) {
  const { matrixSize, path } = useMemo(() => {
    try {
      const matrix = generateQrMatrix(value);
      return {
        matrixSize: matrix.size,
        path: qrMatrixToSvgPath(matrix, 0),
      };
    } catch {
      return { matrixSize: 21, path: '' };
    }
  }, [value]);

  if (!path) return null;

  const viewBoxSize = matrixSize + margin * 2;

  return (
    <svg
      role="img"
      aria-label="QR Code"
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={cn('shrink-0 select-none', className)}
    >
      {bgColor !== 'transparent' && (
        <rect width={viewBoxSize} height={viewBoxSize} fill={bgColor} />
      )}
      <g transform={`translate(${margin}, ${margin})`}>
        <path d={path} fill={fgColor} />
      </g>
    </svg>
  );
}
