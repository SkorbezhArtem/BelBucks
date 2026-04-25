import type { BadgeThemeMode, SiteVisualRule, UserSettings } from './types'
import { resolveSiteRule } from './siteRules'

export function getAutoThemeForHost(hostname: string): { bg: string; text: string } {
  const host = hostname.toLowerCase()
  if (/(^|\.)av\.by$/.test(host)) return { bg: '#4f86ff', text: '#f5f9ff' }
  if (/(^|\.)onliner\.by$/.test(host) || /(^|\.)catalog\.onliner\.by$/.test(host)) return { bg: '#ffd449', text: '#2f2a10' }
  if (/(^|\.)21vek\.by$/.test(host)) return { bg: '#ff4da2', text: '#fff4fb' }
  return { bg: '#7f8fff', text: '#0d1a46' }
}

export function resolveVisualSettingsForHost(settings: UserSettings, host: string): {
  bg: string
  text: string
  fontSizePx: number
  paddingYpx: number
  paddingXpx: number
  themeMode: BadgeThemeMode
  rule: SiteVisualRule | null
} {
  const rule = resolveSiteRule(settings.siteVisualRules, host)

  const themeMode: BadgeThemeMode =
    rule?.themeMode && rule.themeMode !== 'inherit' ? rule.themeMode : settings.badgeThemeMode

  let bg = rule?.badgeBgColor ?? settings.badgeBgColor
  let text = rule?.badgeTextColor ?? settings.badgeTextColor

  if (themeMode === 'auto') {
    const auto = getAutoThemeForHost(host)
    bg = auto.bg
    text = auto.text
  }

  const fontSizePx = rule?.badgeFontSizePx ?? settings.badgeFontSizePx
  const paddingYpx = rule?.badgePaddingYpx ?? settings.badgePaddingYpx
  const paddingXpx = rule?.badgePaddingXpx ?? settings.badgePaddingXpx

  return { bg, text, fontSizePx, paddingYpx, paddingXpx, themeMode, rule }
}

