import type { ReactNode } from 'react'

export interface TabItem<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
}

export interface TabsProps<T extends string> {
  value: T
  items: TabItem<T>[]
  onChange: (next: T) => void
  ariaLabel?: string
}

export function Tabs<T extends string>({ value, items, onChange, ariaLabel }: TabsProps<T>) {
  return (
    <div className="bb-tabs" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const selected = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className="bb-tabs__btn"
            onClick={() => onChange(item.value)}
          >
            {item.icon}
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
