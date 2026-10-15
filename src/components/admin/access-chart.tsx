"use client";

import { useState } from "react";

type Point = { day: string; total: number };

const formatDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
const number = new Intl.NumberFormat("pt-BR");

/** Arredonda o topo do eixo para um valor "redondo" (1, 2, 5 × 10^n). */
function niceMax(value: number): number {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 5, 10]) if (step * magnitude >= value) return step * magnitude;
  return 10 * magnitude;
}

/** Acessos por dia (série única). Valores também disponíveis no tooltip e na tabela abaixo. */
export function AccessChart({ data }: { data: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...data.map((d) => d.total)));
  const ticks = [max, max / 2, 0];
  const labelEvery = Math.ceil(data.length / 10);
  const hovered = hover !== null ? data[hover] : null;

  return (
    <div>
      <div className="relative flex gap-2" role="img" aria-label="Gráfico de acessos por dia; os valores estão na tabela abaixo.">
        {/* Eixo Y */}
        <div className="text-muted-foreground flex h-48 flex-col justify-between text-right text-xs tabular-nums">
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {number.format(t)}
            </span>
          ))}
        </div>

        <div className="relative flex-1">
          {/* Grade recessiva */}
          <div className="pointer-events-none absolute inset-0 flex h-48 flex-col justify-between" aria-hidden="true">
            {ticks.map((t) => (
              <div key={t} className="border-border border-t" />
            ))}
          </div>

          <div className="relative flex h-48 items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
            {data.map((point, index) => (
              <div key={point.day} className="flex h-full flex-1 cursor-default flex-col justify-end" onMouseEnter={() => setHover(index)}>
                {point.total > 0 && (
                  <div
                    className={`rounded-t-[4px] ${hover === null || hover === index ? "opacity-100" : "opacity-60"}`}
                    style={{ height: `${(point.total / max) * 192}px`, background: "var(--series-access)" }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Eixo X */}
          <div className="text-muted-foreground mt-1 flex gap-[2px] text-[10px] tabular-nums" aria-hidden="true">
            {data.map((point, index) => (
              <span key={point.day} className="flex-1 text-center">
                {index % labelEvery === 0 ? formatDay(point.day) : ""}
              </span>
            ))}
          </div>

          {hovered && hover !== null && (
            <div
              className="bg-popover text-popover-foreground pointer-events-none absolute top-0 z-10 rounded-md border px-3 py-2 text-xs shadow-md"
              style={{ left: `${((hover + 0.5) / data.length) * 100}%`, transform: `translateX(${hover > data.length / 2 ? "-105%" : "5%"})` }}
            >
              <p className="font-medium">{formatDay(hovered.day)}</p>
              <p className="tabular-nums">Acessos: {number.format(hovered.total)}</p>
            </div>
          )}
        </div>
      </div>

      <details className="mt-4">
        <summary className="text-muted-foreground cursor-pointer text-sm">Ver dados em tabela</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-muted-foreground text-left">
                <th className="py-1 font-medium">Dia</th>
                <th className="py-1 text-right font-medium">Acessos</th>
              </tr>
            </thead>
            <tbody>
              {data.map((point) => (
                <tr key={point.day} className="border-t">
                  <td className="py-1">{formatDay(point.day)}</td>
                  <td className="py-1 text-right">{number.format(point.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
