import type { ButtonHTMLAttributes, ReactNode } from 'react'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ariaLabel: string
  spinning?: boolean
  children: ReactNode
}

export function IconButton({ ariaLabel, spinning, className, children, ...rest }: IconButtonProps) {
  const cls = ['bb-iconBtn', spinning ? 'bb-iconBtn--spinning' : '', className ?? ''].filter(Boolean).join(' ')
  return (
    <button type="button" aria-label={ariaLabel} className={cls} {...rest}>
      {children}
    </button>
  )
}
