import type { ReactNode } from 'react'

export interface SectionProps {
  title?: ReactNode
  description?: ReactNode
  /** Trailing content rendered next to the title (e.g. status pill, action). */
  aside?: ReactNode
  children: ReactNode
}

/**
 * A titled, surfaced section. Use to visually group related controls.
 */
export function Section({ title, description, aside, children }: SectionProps) {
  return (
    <section className="bb-section">
      {title || aside ? (
        <header className="bb-section__head">
          <div>
            {title ? <div className="bb-section__title">{title}</div> : null}
            {description ? <div className="bb-section__desc">{description}</div> : null}
          </div>
          {aside ? <div>{aside}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  )
}
