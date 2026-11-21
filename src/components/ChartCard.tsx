import React, { useEffect, useRef } from 'react';
import Chart, { ChartConfiguration } from 'chart.js/auto';
import { ThemeId } from '../types/survey';

interface ChartCardProps {
  title: string;
  subtitle: string;
  config: ChartConfiguration;
  testId: string;
  hasData: boolean;
  theme?: ThemeId;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  config,
  testId,
  hasData,
  theme,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!hasData || !canvasRef.current) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
      return;
    }

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    chartInstanceRef.current = new Chart(canvasRef.current, config);

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [config, hasData, theme]);

  return (
    <section className="theme-surface rounded-lg border p-5">
      <div className="mb-4">
        <h2 className="theme-heading text-base font-semibold">{title}</h2>
        <p className="theme-muted mt-0.5 text-xs">{subtitle}</p>
      </div>
      {hasData ? (
        <div className="relative h-72 w-full">
          <canvas ref={canvasRef} data-testid={testId} aria-label={title} />
        </div>
      ) : (
        <div className="theme-surface-muted theme-muted flex h-72 items-center justify-center rounded-md border border-dashed px-4 text-center text-sm">
          No responses available in the selected dataset scope.
        </div>
      )}
    </section>
  );
};
