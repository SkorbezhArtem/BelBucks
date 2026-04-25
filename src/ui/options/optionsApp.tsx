import { useEffect, useMemo, useState } from 'react'
import { DEFAULT_SETTINGS, getSettings, setSettings } from '../../shared/storage'
import type { RateProvider, TargetCurrency, UserSettings } from '../../shared/types'

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/g)
    .map((s) => s.trim())
    .filter(Boolean)
}

function joinLines(value: string[]): string {
  return value.join('\n')
}

export function OptionsApp() {
  const [loaded, setLoaded] = useState(false)
  const [s, setS] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [status, setStatus] = useState<string>('')

  useEffect(() => {
    void getSettings().then((settings) => {
      setS(settings)
      setLoaded(true)
    })
  }, [])

  const customRateText = useMemo(() => {
    const r = s.customRates ?? {}
    return {
      USD: r.USD?.toString() ?? '',
      EUR: r.EUR?.toString() ?? '',
      PLN: r.PLN?.toString() ?? '',
      RUB: r.RUB?.toString() ?? '',
    }
  }, [s.customRates])

  async function save(next: UserSettings) {
    setS(next)
    await setSettings(next)
    setStatus('Saved.')
    window.setTimeout(() => setStatus(''), 1200)
  }

  async function refreshRates() {
    setStatus('Refreshing rates…')
    try {
      const res = (await chrome.runtime.sendMessage({ type: 'bb_refresh_rates' })) as { ok: boolean; error?: string }
      setStatus(res.ok ? 'Rates refreshed.' : `Refresh failed: ${res.error ?? 'unknown error'}`)
    } catch (e) {
      setStatus(`Refresh failed: ${String(e)}`)
    } finally {
      window.setTimeout(() => setStatus(''), 1800)
    }
  }

  const providerOptions: { id: RateProvider; label: string }[] = [
    { id: 'NBRB', label: 'НБРБ (официальный)' },
    { id: 'BankAverage', label: 'Средний по банкам (агрегированный фид, MVP)' },
    { id: 'BankBest', label: 'Лучший по банкам (агрегированный фид, MVP; ориентир как в Myfin)' },
    { id: 'BankSpecific', label: 'Конкретный банк (MVP: Беларусьбанк, город Минск)' },
    { id: 'Custom', label: 'Custom rate (вручную)' },
  ]

  const currencyOptions: TargetCurrency[] = ['USD', 'EUR', 'PLN', 'RUB']

  return (
    <div className="bb-page">
      <header className="bb-header">
        <div className="bb-title">BelBucks</div>
        <div className="bb-subtitle">Options</div>
      </header>
      <main className="bb-card">
        {!loaded ? (
          <p className="bb-muted">Loading…</p>
        ) : (
          <div className="bb-form">
            <div className="bb-row">
              <label className="bb-label">
                <span>Включено</span>
                <input
                  type="checkbox"
                  checked={s.enabled}
                  onChange={(e) => void save({ ...s, enabled: e.target.checked })}
                />
              </label>
              <button className="bb-btn" type="button" onClick={() => void refreshRates()}>
                Refresh rates now
              </button>
              <div className="bb-status">{status}</div>
            </div>

            <hr className="bb-hr" />

            <div className="bb-grid">
              <label className="bb-label">
                <span>Целевая валюта</span>
                <select
                  value={s.targetCurrency}
                  onChange={(e) => void save({ ...s, targetCurrency: e.target.value as TargetCurrency })}
                >
                  {currencyOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label className="bb-label">
                <span>Вторая валюта (опционально)</span>
                <select
                  value={s.secondaryCurrency}
                  onChange={(e) =>
                    void save({ ...s, secondaryCurrency: e.target.value as UserSettings['secondaryCurrency'] })
                  }
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
                  value={s.rateProvider}
                  onChange={(e) => void save({ ...s, rateProvider: e.target.value as RateProvider })}
                >
                  {providerOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="bb-label">
                <span>Наценка банка: {s.markupPercent.toFixed(1)}%</span>
                <input
                  type="range"
                  min={-5}
                  max={10}
                  step={0.1}
                  value={s.markupPercent}
                  onChange={(e) => void save({ ...s, markupPercent: Number(e.target.value) })}
                />
              </label>

              <label className="bb-label">
                <span>Режим отображения</span>
                <select
                  value={s.displayMode}
                  onChange={(e) => void save({ ...s, displayMode: e.target.value as UserSettings['displayMode'] })}
                >
                  <option value="inline">Inline</option>
                  <option value="tooltip">Tooltip</option>
                </select>
              </label>

              <label className="bb-label">
                <span>Цвет карточки</span>
                <input
                  type="color"
                  value={s.badgeBgColor}
                  disabled={s.badgeThemeMode === 'auto'}
                  onChange={(e) => void save({ ...s, badgeBgColor: e.target.value })}
                />
              </label>

              <label className="bb-label">
                <span>Цвет текста в карточке</span>
                <input
                  type="color"
                  value={s.badgeTextColor}
                  disabled={s.badgeThemeMode === 'auto'}
                  onChange={(e) => void save({ ...s, badgeTextColor: e.target.value })}
                />
              </label>
            </div>

            <div className="bb-row">
              <button
                className="bb-btn"
                type="button"
                onClick={() => void save({ ...s, badgeThemeMode: s.badgeThemeMode === 'auto' ? 'manual' : 'auto' })}
              >
                {s.badgeThemeMode === 'auto' ? 'Auto theme: ON' : 'Auto theme: OFF'}
              </button>
              <span className="bb-status">Auto: av.by=blue, Onliner=yellow</span>
            </div>

            {s.rateProvider === 'Custom' ? (
              <>
                <hr className="bb-hr" />
                <div className="bb-muted" style={{ marginBottom: 8 }}>
                  Custom rate: 1 TARGET = X BYN
                </div>
                <div className="bb-grid">
                  {currencyOptions.map((c) => (
                    <label className="bb-label" key={c}>
                      <span>{c} → BYN</span>
                      <input
                        inputMode="decimal"
                        placeholder="например 3.25"
                        value={(customRateText as Record<string, string>)[c]}
                        onChange={(e) => {
                          const v = e.target.value.trim()
                          const n = v ? Number(v.replace(',', '.')) : NaN
                          const nextRates = { ...(s.customRates ?? {}) }
                          if (!v) delete nextRates[c]
                          else nextRates[c as TargetCurrency] = n
                          void save({ ...s, customRates: nextRates })
                        }}
                      />
                    </label>
                  ))}
                </div>
              </>
            ) : null}

            <hr className="bb-hr" />

            <div className="bb-grid">
              <label className="bb-label">
                <span>Работать только по whitelist</span>
                <input
                  type="checkbox"
                  checked={s.useWhitelistOnly}
                  onChange={(e) => void save({ ...s, useWhitelistOnly: e.target.checked })}
                />
              </label>
              <div />
              <label className="bb-label">
                <span>Whitelist (1 домен на строку)</span>
                <textarea
                  rows={6}
                  value={joinLines(s.whitelistDomains)}
                  onChange={(e) => void save({ ...s, whitelistDomains: splitLines(e.target.value) })}
                />
              </label>
              <label className="bb-label">
                <span>Blacklist (1 домен на строку)</span>
                <textarea
                  rows={6}
                  value={joinLines(s.blacklistDomains)}
                  onChange={(e) => void save({ ...s, blacklistDomains: splitLines(e.target.value) })}
                />
              </label>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

