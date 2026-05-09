import type { UiThemeMode } from '../shared/types'

/**
 * Apply a theme mode to <html>. 'auto' clears the data attribute and lets the
 * browser's `prefers-color-scheme` decide; 'light' / 'dark' force the chrome
 * regardless of system preference.
 *
 * Designed to be safe to call on every render: it only writes the attribute
 * when it actually changes.
 */
export function applyUiThemeMode(mode: UiThemeMode): void {
  const root = document.documentElement
  const current = root.getAttribute('data-bb-theme') ?? ''
  if (mode === 'auto') {
    if (current) root.removeAttribute('data-bb-theme')
    return
  }
  if (current !== mode) root.setAttribute('data-bb-theme', mode)
}
