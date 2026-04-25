import { useEffect, useMemo, useState } from 'react'
import type { PriceHistoryEntry } from '../../shared/priceTracker'
import { clearPriceHistoryForUrl, loadPriceHistory } from '../../shared/priceTracker'
import { getSettings, setSettings } from '../../shared/storage'
import { isEnabledForSite, upsertHostRule } from '../../shared/siteRules'
import type { RateProvider, TargetCurrency, UserSettings } from '../../shared/types'

function formatTime(t: number): string {
  return new Date(t).toLocaleString()
}

function sanitizeDisplayPoints(points: { t: number; byn: number }[]): { t: number; byn: number }[] {
  const base = points.filter((p) => Number.isFinite(p.byn) && p.byn >= 1)
  if (base.length <= 1) return base

  const out: { t: number; byn: number }[] = [base[0]]
  for (let i = 1; i < base.length; i++) {
    const prev = out[out.length - 1]
    const cur = base[i]
    if (!prev) {
      out.push(cur)
      continue
    }
    if (cur.byn > prev.byn * 8) {
      const next = base[i + 1]
      if (!next || cur.byn > next.byn * 6) continue
    }
    out.push(cur)
  }
  return out
}

function Sparkline({ points }: { points: { t: number; byn: number }[] }) {
  const path = useMemo(() => {
    if (points.length < 2) return ''
    const values = points.map((p) => p.byn)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min || 1
    const w = 120
    const h = 28
    return points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * w
        const y = h - ((p.byn - min) / span) * h
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }, [points])

  return (
    <svg width="120" height="28" viewBox="0 0 120 28" style={{ display: 'block' }}>
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" opacity="0.85" />
    </svg>
  )
}

export function PopupApp() {
  const [entry, setEntry] = useState<PriceHistoryEntry | null>(null)
  const [err, setErr] = useState<string>('')
  const [settings, setSettingsState] = useState<UserSettings | null>(null)
  const [status, setStatus] = useState('')
  const [activeHost, setActiveHost] = useState<string>('')
  const [activeUrl, setActiveUrl] = useState<string>('')

  useEffect(() => {
    async function load() {
      setErr('')
      try {
        const s = await getSettings()
        setSettingsState(s)

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        const url = tab?.url
        setActiveUrl(url ?? '')
        let host = ''
        try {
          host = url ? new URL(url).hostname : ''
        } catch {
          host = ''
        }
        setActiveHost(host)
        if (!url) {
          setEntry(null)
          return
        }
        const store = await loadPriceHistory()
        const key = url.split('#')[0]
        const exact = store[key]
        if (exact) {
          setEntry(exact)
          return
        }

        // Fallback: same origin+pathname (ignore query-string changes)
        let fallback: PriceHistoryEntry | null = null
        try {
          const u = new URL(key)
          for (const e of Object.values(store)) {
            const eu = new URL(e.url)
            if (eu.origin === u.origin && eu.pathname === u.pathname) {
              if (!fallback || (e.points.at(-1)?.t ?? 0) > (fallback.points.at(-1)?.t ?? 0)) {
                fallback = e
              }
            }
          }
        } catch {
          // ignore malformed URLs
        }
        setEntry(fallback)
      } catch (e) {
        setErr(String(e))
      }
    }
    void load()
  }, [])

  async function save(next: UserSettings) {
    setSettingsState(next)
    await setSettings(next)
    setStatus('Saved')
    window.setTimeout(() => setStatus(''), 1000)
  }

  async function refreshRates() {
    setStatus('Refreshing…')
    try {
      const res = (await chrome.runtime.sendMessage({ type: 'bb_refresh_rates' })) as {
        ok: boolean
        warning?: string
        error?: string
      }
      if (!res.ok) setStatus(`Refresh failed`)
      else if (res.warning) setStatus('Rates updated (fallback)')
      else setStatus('Rates updated')
    } catch {
      setStatus('Refresh failed')
    } finally {
      window.setTimeout(() => setStatus(''), 1500)
    }
  }

  async function resetCurrentPageHistory() {
    if (!activeUrl) return
    setStatus('Clearing history…')
    try {
      const removed = await clearPriceHistoryForUrl(activeUrl)
      setEntry(null)
      setStatus(removed > 0 ? 'History cleared' : 'No history to clear')
    } catch {
      setStatus('Clear failed')
    } finally {
      window.setTimeout(() => setStatus(''), 1400)
    }
  }

  const currencyOptions: TargetCurrency[] = ['USD', 'EUR', 'PLN', 'RUB']
  const providerOptions: { id: RateProvider; label: string }[] = [
    { id: 'NBRB', label: 'НБРБ' },
    { id: 'BankAverage', label: 'Средний по банкам' },
    { id: 'BankBest', label: 'Лучший по банкам' },
    { id: 'BankSpecific', label: 'Конкретный банк' },
    { id: 'Custom', label: 'Custom' },
  ]

  const displayPoints = entry ? sanitizeDisplayPoints(entry.points) : []
  const last = displayPoints.at(-1)
  const enabledForThisSite =
    settings && activeHost
      ? isEnabledForSite({
          enabledGlobal: settings.enabled,
          host: activeHost,
          defaultMode: settings.siteDefaultMode,
          rules: settings.siteRules,
        })
      : true

  return (
    <div className="bb-popup">
      <div className="bb-title">BelBucks</div>
      {settings ? (
        <div className="bb-popup-controls">
          {activeHost ? (
            <label className="bb-popup-line">
              <span>Этот сайт</span>
              <input
                type="checkbox"
                checked={!!enabledForThisSite}
                onChange={(e) => {
                  const nextRules = upsertHostRule(settings.siteRules, activeHost, e.target.checked ? 'allow' : 'block')
                  void save({ ...settings, siteRules: nextRules })
                }}
              />
            </label>
          ) : null}
          <label className="bb-popup-line">
            <span>On</span>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => void save({ ...settings, enabled: e.target.checked })}
            />
          </label>

          <label className="bb-label">
            <span>Основная валюта</span>
            <select
              value={settings.targetCurrency}
              onChange={(e) => void save({ ...settings, targetCurrency: e.target.value as TargetCurrency })}
            >
              {currencyOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="bb-label">
            <span>Вторая валюта</span>
            <select
              value={settings.secondaryCurrency}
              onChange={(e) => void save({ ...settings, secondaryCurrency: e.target.value as UserSettings['secondaryCurrency'] })}
            >
              <option value="NONE">Не показывать</option>
              {currencyOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="bb-label">
            <span>Источник курса</span>
            <select
              value={settings.rateProvider}
              onChange={(e) => void save({ ...settings, rateProvider: e.target.value as RateProvider })}
            >
              {providerOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <div className="bb-popup-grid">
            <label className="bb-label">
              <span>Цвет карточки</span>
              <input
                type="color"
                value={settings.badgeBgColor}
                disabled={settings.badgeThemeMode === 'auto'}
                onChange={(e) => void save({ ...settings, badgeBgColor: e.target.value })}
              />
            </label>
            <label className="bb-label">
              <span>Цвет текста</span>
              <input
                type="color"
                value={settings.badgeTextColor}
                disabled={settings.badgeThemeMode === 'auto'}
                onChange={(e) => void save({ ...settings, badgeTextColor: e.target.value })}
              />
            </label>
          </div>

          <div className="bb-row">
            <button
              className="bb-btn"
              type="button"
              onClick={() =>
                void save({ ...settings, badgeThemeMode: settings.badgeThemeMode === 'auto' ? 'manual' : 'auto' })
              }
            >
              {settings.badgeThemeMode === 'auto' ? 'Auto theme ON' : 'Auto theme OFF'}
            </button>
            <button className="bb-btn" type="button" onClick={() => void refreshRates()}>
              Обновить курс
            </button>
            <button className="bb-btn" type="button" onClick={() => void resetCurrentPageHistory()}>
              Reset history
            </button>
            <button className="bb-btn" type="button" onClick={() => chrome.runtime.openOptionsPage()}>
              Полные настройки
            </button>
            <span className="bb-status">{status}</span>
          </div>
        </div>
      ) : null}
      {err ? <div className="bb-muted">Error: {err}</div> : null}
      {!entry || !last ? (
        <div className="bb-muted" style={{ marginTop: 8 }}>
          Нет данных трекера для текущей вкладки.
        </div>
      ) : (
        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          <div className="bb-muted" style={{ lineHeight: 1.35 }}>
            <div style={{ color: 'rgba(255,255,255,.92)', fontWeight: 600 }}>{entry.title || entry.url}</div>
            <div>Последняя: {last.byn.toFixed(2)} BYN</div>
            <div>{formatTime(last.t)}</div>
          </div>
          <Sparkline points={displayPoints} />
        </div>
      )}
    </div>
  )
}

