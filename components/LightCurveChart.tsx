"use client";

import { useMemo } from "react";
import {
  Brush,
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DataQualityFlag, FluxDataPoint } from "@/types/photometry";

interface LightCurveChartProps {
  points: readonly FluxDataPoint[];
}

const QUALITY_COLORS: Record<DataQualityFlag, string> = {
  clean: "#c9a86a",
  cosmic_ray: "#f97316",
  safe_mode: "#ef4444",
  attitude_tweak: "#eab308",
  argabrightening: "#a855f7",
  reaction_wheel_desat: "#f472b6",
};

interface ChartPoint {
  time: number;
  flux: number;
  fluxError: number;
  qualityFlag: DataQualityFlag;
  fill: string;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: readonly { payload: ChartPoint }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-sm border border-line bg-surface p-3 text-base shadow-lg">
      <p className="font-mono text-ink">
        BJD: <span className="text-accent">{point.time.toFixed(5)}</span>
      </p>
      <p className="font-mono text-ink">
        Flux: <span className="text-accent">{point.flux.toFixed(6)}</span>
      </p>
      <p className="font-mono text-ink">
        Error: <span className="text-ink-muted">+/-{point.fluxError.toFixed(6)}</span>
      </p>
      <p className="font-mono text-ink">
        Calidad:{" "}
        <span style={{ color: QUALITY_COLORS[point.qualityFlag] }}>
          {point.qualityFlag}
        </span>
      </p>
    </div>
  );
}

const MAX_CHART_POINTS = 5000;

/**
 * Submuestreo para visualizacion: el motor de vetting siempre trabaja
 * sobre el dataset completo (esto NO afecta la precision del analisis),
 * pero renderizar decenas de miles de elementos SVG individuales en
 * Recharts congela el navegador. Se toma 1 de cada N puntos, distribuido
 * uniformemente, para mantener la forma visual de la curva sin renderizar
 * cada punto real.
 */
function downsampleForDisplay(
  points: readonly FluxDataPoint[],
  maxPoints: number
): readonly FluxDataPoint[] {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  return points.filter((_, index) => index % step === 0);
}

export function LightCurveChart({ points }: LightCurveChartProps) {
  const displayPoints = useMemo(
    () => downsampleForDisplay(points, MAX_CHART_POINTS),
    [points]
  );

  const chartData = useMemo<ChartPoint[]>(
    () =>
      displayPoints.map((p) => ({
        time: p.time,
        flux: p.flux,
        fluxError: p.fluxError,
        qualityFlag: p.qualityFlag,
        fill: QUALITY_COLORS[p.qualityFlag],
      })),
    [displayPoints]
  );

  if (points.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center rounded-sm border border-line bg-surface text-base text-ink-muted">
        Carga una curva de luz para visualizarla aqui.
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-line bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-base text-ink-muted">
        {Object.entries(QUALITY_COLORS).map(([flag, color]) => (
          <div key={flag} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            {flag}
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={420}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
          <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
          <XAxis
            dataKey="time"
            type="number"
            domain={["dataMin", "dataMax"]}
            tick={{ fill: "#a1a1aa", fontSize: 13 }}
            stroke="#3f3f46"
            label={{
              value: "Tiempo (BJD)",
              position: "insideBottom",
              offset: -5,
              fill: "#71717a",
              fontSize: 14,
            }}
          />
          <YAxis
            dataKey="flux"
            type="number"
            domain={["auto", "auto"]}
            tick={{ fill: "#a1a1aa", fontSize: 13 }}
            stroke="#3f3f46"
            label={{
              value: "Flujo normalizado",
              angle: -90,
              position: "insideLeft",
              fill: "#71717a",
              fontSize: 14,
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Scatter data={chartData} fill="#c9a86a" isAnimationActive={false} />
          <Brush
            dataKey="time"
            height={24}
            stroke="#c9a86a"
            fill="#18181b"
            travellerWidth={8}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}