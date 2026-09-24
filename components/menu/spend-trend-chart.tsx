import type { SpendTrendPoint } from '@/lib/menu/get-spend-trend';
import { Card, CardContent } from '@/components/ui/card';
import { formatPrecio } from '@/lib/utils';

export interface SpendTrendChartProps {
  trend: SpendTrendPoint[]
}

const CHART_HEIGHT = 64;
const CHART_WIDTH = 280;
const POINT_RADIUS = 3;

/** How many of the trend's weeks actually have a real value -- below this, there's nothing to draw a trend line between. */
const MIN_POINTS_FOR_TREND = 2;

/**
 * FRESCO-535 -- weekly spend trend, last 8 ISO weeks. Plain inline SVG
 * polyline (no charting library in this repo yet, and a single trend line
 * doesn't need one). Gap weeks (`costeEstimado: null`) break the line
 * instead of being coerced to 0 -- a real gap must read as "no dato", never
 * as "gastó cero esa semana".
 */
export function SpendTrendChart({ trend }: SpendTrendChartProps) {
  const withData = trend.filter(point => point.costeEstimado !== null);

  if (withData.length < MIN_POINTS_FOR_TREND) {
    return (
      <Card data-testid="spend_trend_chart_empty">
        <CardContent>
          <p className="text-body-sm text-tertiary">
            Todavía no hay suficientes semanas para mostrar una tendencia de gasto.
          </p>
        </CardContent>
      </Card>
    );
  }

  const values = withData.map(point => point.costeEstimado as number);
  const max = Math.max(...values);
  const min = Math.min(...values);
  // A flat series (max === min) would divide by zero below -- fall back to a
  // 1-unit spread so a single-value trend still renders as a flat, centered
  // line instead of NaN coordinates.
  const range = max - min || 1;

  const stepX = CHART_WIDTH / (trend.length - 1);

  const points = trend.map((point, index) => {
    if (point.costeEstimado === null) {
      return null;
    }
    const x = index * stepX;
    const y = CHART_HEIGHT - ((point.costeEstimado - min) / range) * CHART_HEIGHT;
    return { x, y, semanaIso: point.semanaIso, costeEstimado: point.costeEstimado };
  });

  // Consecutive runs of real points -- each run draws its own polyline
  // segment, so a gap week breaks the line instead of interpolating across it.
  const segments: NonNullable<(typeof points)[number]>[][] = [];
  let current: NonNullable<(typeof points)[number]>[] = [];
  for (const point of points) {
    if (point === null) {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
      continue;
    }
    current.push(point);
  }
  if (current.length > 0) {
    segments.push(current);
  }

  return (
    <Card data-testid="spend_trend_chart">
      <CardContent>
        <p className="text-body-sm text-tertiary">Tendencia de gasto semanal</p>
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="mt-2 w-full"
          role="img"
          aria-label={`Gasto semanal estimado de las últimas ${trend.length} semanas`}
        >
          {segments.map(segment => (
            <polyline
              key={segment[0].semanaIso}
              points={segment.map(point => `${point.x},${point.y}`).join(' ')}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth={2}
            />
          ))}
          {points.map(point => point && (
            <circle
              key={point.semanaIso}
              cx={point.x}
              cy={point.y}
              r={POINT_RADIUS}
              fill="var(--color-primary)"
            >
              <title>
                {point.semanaIso}
                {': '}
                {formatPrecio(point.costeEstimado)}
              </title>
            </circle>
          ))}
        </svg>
      </CardContent>
    </Card>
  );
}
