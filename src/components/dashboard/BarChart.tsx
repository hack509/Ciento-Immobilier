import { useState } from 'react';

interface BarChartProps {
  data: { label: string; value: number }[];
  /** Accessible title; also used as the series name in the tooltip. */
  title: string;
  formatValue?: (value: number) => string;
  height?: number;
}

/**
 * Single-series bar chart (no legend needed: the title names the series).
 * Thin bars with rounded data-ends on a recessive baseline, hover/focus tooltip,
 * and a visually hidden table for screen readers.
 */
export function BarChart({ data, title, formatValue = (v) => v.toLocaleString('fr-HT'), height = 160 }: BarChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const current = active !== null ? data[active] : null;

  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-gray-400">Pas encore de données sur cette période.</p>;
  }

  return (
    <figure className="relative">
      <figcaption className="sr-only">{title}</figcaption>
      <div className="mb-2 h-5 text-xs text-gray-500" aria-live="polite">
        {current ? (
          <span><span className="font-semibold text-primary-900">{formatValue(current.value)}</span> · {current.label}</span>
        ) : (
          <span>Survolez une barre pour le détail</span>
        )}
      </div>
      <div className="flex items-end gap-[2px] border-b border-gray-200" style={{ height }} onMouseLeave={() => setActive(null)}>
        {data.map((d, i) => (
          <button
            key={d.label}
            type="button"
            className="group flex h-full min-w-0 flex-1 items-end focus:outline-none"
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            aria-label={`${d.label} : ${formatValue(d.value)}`}
          >
            <span
              className={`block w-full rounded-t-[4px] transition-colors ${active === i ? 'bg-secondary-500' : 'bg-brand-blue group-hover:bg-primary-600'}`}
              style={{ height: `${Math.max((d.value / max) * 100, d.value > 0 ? 3 : 0)}%` }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-gray-400">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => <tr key={d.label}><th scope="row">{d.label}</th><td>{formatValue(d.value)}</td></tr>)}
        </tbody>
      </table>
    </figure>
  );
}
