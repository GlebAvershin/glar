/**
 * OurApp — простой SVG bar-chart (ТЗ-05 §6).
 *
 * Без зависимостей — нативный SVG. Подходит для дашборда расхода кредитов
 * по дням. Использует наш emerald accent. Hover — тултип с значением.
 */
import { For, Show, createMemo, createSignal, type Component } from "solid-js"

export interface BarChartProps {
  data: Array<{ label: string; value: number }>
  height?: number
  /** Подпись Y-axis для тултипа, напр. «кредитов». */
  unit?: string
  /** Форматтер метки — по умолчанию as-is. */
  formatLabel?: (label: string) => string
}

export const BarChart: Component<BarChartProps> = (props) => {
  const height = () => props.height ?? 180
  const max = () => Math.max(1, ...props.data.map((d) => d.value))
  const [hover, setHover] = createSignal<number | null>(null)

  const total = createMemo(() => props.data.reduce((s, d) => s + d.value, 0))

  const formatLabel = (l: string) => (props.formatLabel ? props.formatLabel(l) : l)

  return (
    <Show
      when={props.data.length > 0}
      fallback={<div class="ourapp-chart-empty">Нет данных за период</div>}
    >
      <div class="ourapp-chart">
        <svg
          class="ourapp-chart__svg"
          viewBox={`0 0 ${props.data.length * 24} ${height()}`}
          preserveAspectRatio="none"
          aria-label="График расхода"
        >
          <For each={props.data}>
            {(d, i) => {
              const h = (d.value / max()) * (height() - 24)
              return (
                <g
                  class="ourapp-chart__bar"
                  classList={{ "ourapp-chart__bar--hover": hover() === i() }}
                  onMouseEnter={() => setHover(i())}
                  onMouseLeave={() => setHover(null)}
                >
                  <rect
                    x={i() * 24 + 4}
                    y={height() - h - 4}
                    width={16}
                    height={Math.max(1, h)}
                    rx={2}
                  />
                </g>
              )
            }}
          </For>
        </svg>
        <div class="ourapp-chart__labels">
          <span>{formatLabel(props.data[0]?.label ?? "")}</span>
          <span>{formatLabel(props.data[props.data.length - 1]?.label ?? "")}</span>
        </div>
        <Show when={hover() !== null}>
          <div class="ourapp-chart__tooltip">
            <span class="ourapp-chart__tooltipDate">
              {formatLabel(props.data[hover()!]?.label ?? "")}
            </span>
            <span class="ourapp-chart__tooltipValue">
              {props.data[hover()!]?.value} {props.unit ?? ""}
            </span>
          </div>
        </Show>
        <div class="ourapp-chart__total">Итого: {total()} {props.unit ?? ""}</div>
      </div>
    </Show>
  )
}
