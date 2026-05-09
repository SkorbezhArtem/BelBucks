import type { ChangeEventHandler, ReactNode } from 'react'

export interface SwitchProps {
  checked: boolean
  onChange: (next: boolean) => void
  ariaLabel?: string
  disabled?: boolean
  id?: string
}

export function Switch({ checked, onChange, ariaLabel, disabled, id }: SwitchProps) {
  const handle: ChangeEventHandler<HTMLInputElement> = (e) => onChange(e.target.checked)
  return (
    <span className="bb-switch" data-checked={checked ? 'true' : 'false'}>
      <input
        type="checkbox"
        role="switch"
        aria-label={ariaLabel}
        aria-checked={checked}
        checked={checked}
        disabled={disabled}
        onChange={handle}
        id={id}
      />
      <span className="bb-switch__track" aria-hidden />
      <span className="bb-switch__thumb" aria-hidden />
    </span>
  )
}

export interface SwitchRowProps {
  title: ReactNode
  description?: ReactNode
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}

/** A title + optional sub-text on the left, switch on the right. */
export function SwitchRow({ title, description, checked, onChange, disabled }: SwitchRowProps) {
  return (
    <label className="bb-switchRow">
      <span className="bb-switchRow__main">
        <span className="bb-switchRow__title">{title}</span>
        {description ? <span className="bb-switchRow__desc">{description}</span> : null}
      </span>
      <Switch checked={checked} onChange={onChange} disabled={disabled} />
    </label>
  )
}
