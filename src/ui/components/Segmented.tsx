import type { ReactNode } from 'react'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  ariaLabel?: string
}

export interface SegmentedProps<T extends string> {
  value: T
  options: SegmentedOption<T>[]
  onChange: (next: T) => void
  /** Stretch each option to fill the row equally. */
  block?: boolean
  ariaLabel?: string
}

export function Segmented<T extends string>({ value, options, onChange, block, ariaLabel }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`bb-segmented${block ? ' bb-segmented--block' : ''}`}>
      {options.map((opt) => {
        const selected = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-selected={selected}
            aria-label={opt.ariaLabel}
            tabIndex={selected ? 0 : -1}
            className="bb-segmented__btn"
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
