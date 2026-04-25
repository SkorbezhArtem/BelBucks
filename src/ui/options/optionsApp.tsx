import { useEffect, useMemo, useState } from 'react'
import { DEFAULT_SETTINGS, getSettings, setSettings } from '../../shared/storage'
import { isEnabledForSite, removeRule, sortRulesForDisplay, upsertRule } from '../../shared/siteRules'
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
  const [showLegacy, setShowLegacy] = useState(false)
  const [newRulePattern, setNewRulePattern] = useState('')
  const [newRuleWildcard, setNewRuleWildcard] = useState(false)
  const [newRuleMode, setNewRuleMode] = useState<'allow' | 'block'>('allow')

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
  const displayRules = useMemo(() => sortRulesForDisplay(s.siteRules), [s.siteRules])

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

            <div className="bb-row">
              <div className="bb-muted">
                Пер-сайтовое управление: default + правила (поддержка `*.domain`). Это заменяет старые whitelist/blacklist.
              </div>
            </div>

            <div className="bb-grid">
              <label className="bb-label">
                <span>Default behavior</span>
                <select
                  value={s.siteDefaultMode}
                  onChange={(e) => void save({ ...s, siteDefaultMode: e.target.value as UserSettings['siteDefaultMode'] })}
                >
                  <option value="enabledEverywhere">Enabled everywhere</option>
                  <option value="disabledEverywhere">Disabled everywhere</option>
                </select>
              </label>
              <div />

              <div className="bb-label">
                <span>Add rule</span>
                <div className="bb-row" style={{ gap: 8 }}>
                  <select value={newRuleMode} onChange={(e) => setNewRuleMode(e.target.value as 'allow' | 'block')}>
                    <option value="allow">Allow</option>
                    <option value="block">Block</option>
                  </select>
                  <input
                    style={{ flex: 1, minWidth: 220 }}
                    value={newRulePattern}
                    onChange={(e) => setNewRulePattern(e.target.value)}
                    placeholder="example.com"
                  />
                  <label className="bb-popup-line" style={{ minWidth: 140 }}>
                    <span>*.subdomains</span>
                    <input
                      type="checkbox"
                      checked={newRuleWildcard}
                      onChange={(e) => setNewRuleWildcard(e.target.checked)}
                    />
                  </label>
                  <button
                    className="bb-btn"
                    type="button"
                    onClick={() => {
                      const base = newRulePattern.trim()
                      if (!base) return
                      const pattern = newRuleWildcard ? `*.${base.replace(/^\*\.\s*/, '')}` : base
                      void save({ ...s, siteRules: upsertRule(s.siteRules, { pattern, mode: newRuleMode }) })
                      setNewRulePattern('')
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>

              <label className="bb-label">
                <span>Quick check (type a hostname)</span>
                <HostnameTester
                  defaultMode={s.siteDefaultMode}
                  rules={s.siteRules}
                  enabledGlobal={s.enabled}
                />
              </label>
            </div>

            <div className="bb-ruleTable" style={{ marginTop: 10 }}>
              {displayRules.length === 0 ? (
                <div className="bb-muted" style={{ padding: 12 }}>
                  No rules yet.
                </div>
              ) : (
                displayRules.map((r) => (
                  <div className="bb-ruleRow" key={`${r.mode}:${r.pattern}`}>
                    <div>
                      <span className={`bb-pill ${r.mode === 'allow' ? 'bb-pillAllow' : 'bb-pillBlock'}`}>
                        {r.mode === 'allow' ? 'ALLOW' : 'BLOCK'}
                      </span>
                    </div>
                    <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace' }}>
                      {r.pattern}
                    </div>
                    <div className="bb-row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                      <button
                        className="bb-btn"
                        type="button"
                        onClick={() => void save({ ...s, siteRules: upsertRule(s.siteRules, { pattern: r.pattern, mode: 'allow' }) })}
                      >
                        Allow
                      </button>
                      <button
                        className="bb-btn"
                        type="button"
                        onClick={() => void save({ ...s, siteRules: upsertRule(s.siteRules, { pattern: r.pattern, mode: 'block' }) })}
                      >
                        Block
                      </button>
                      <button
                        className="bb-btn bb-btnDanger"
                        type="button"
                        onClick={() => void save({ ...s, siteRules: removeRule(s.siteRules, r.pattern) })}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="bb-row" style={{ marginTop: 10 }}>
              <button className="bb-btn" type="button" onClick={() => setShowLegacy((v) => !v)}>
                {showLegacy ? 'Hide legacy lists' : 'Show legacy whitelist/blacklist'}
              </button>
              <button
                className="bb-btn"
                type="button"
                onClick={() => {
                  const rules = [
                    ...s.blacklistDomains.map((d) => ({ pattern: d.trim(), mode: 'block' as const })),
                    ...s.whitelistDomains.map((d) => ({ pattern: d.trim(), mode: 'allow' as const })),
                  ]
                  if (rules.length === 0) return
                  let next = s.siteRules
                  for (const rr of rules) next = upsertRule(next, rr)
                  void save({ ...s, siteRules: next })
                }}
              >
                Import legacy into rules
              </button>
            </div>

            {showLegacy ? (
              <>
                <hr className="bb-hr" />
                <div className="bb-grid">
                  <label className="bb-label">
                    <span>Работать только по whitelist (legacy)</span>
                    <input
                      type="checkbox"
                      checked={s.useWhitelistOnly}
                      onChange={(e) => void save({ ...s, useWhitelistOnly: e.target.checked })}
                    />
                  </label>
                  <div />
                  <label className="bb-label">
                    <span>Whitelist (1 домен на строку, legacy)</span>
                    <textarea
                      rows={6}
                      value={joinLines(s.whitelistDomains)}
                      onChange={(e) => void save({ ...s, whitelistDomains: splitLines(e.target.value) })}
                    />
                  </label>
                  <label className="bb-label">
                    <span>Blacklist (1 домен на строку, legacy)</span>
                    <textarea
                      rows={6}
                      value={joinLines(s.blacklistDomains)}
                      onChange={(e) => void save({ ...s, blacklistDomains: splitLines(e.target.value) })}
                    />
                  </label>
                </div>
              </>
            ) : null}
          </div>
        )}
      </main>
    </div>
  )
}

function HostnameTester(props: {
  enabledGlobal: boolean
  defaultMode: UserSettings['siteDefaultMode']
  rules: UserSettings['siteRules']
}) {
  const [host, setHost] = useState('catalog.onliner.by')
  const enabled = isEnabledForSite({
    enabledGlobal: props.enabledGlobal,
    host,
    defaultMode: props.defaultMode,
    rules: props.rules,
  })

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="example.com" />
      <div className="bb-muted">Result: {enabled ? 'ENABLED' : 'DISABLED'}</div>
    </div>
  )
}

