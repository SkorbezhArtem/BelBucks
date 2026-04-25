import { useEffect, useMemo, useState } from 'react'
import { DEFAULT_SETTINGS, getSettings, setSettings } from '../../shared/storage'
import { isEnabledForSite, removeRule, sortRulesForDisplay, upsertRule } from '../../shared/siteRules'
import type { RateProvider, SiteVisualRule, TargetCurrency, UserSettings } from '../../shared/types'

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

  const [newVisualPattern, setNewVisualPattern] = useState('')
  const [newVisualWildcard, setNewVisualWildcard] = useState(false)
  const [newVisualThemeMode, setNewVisualThemeMode] = useState<SiteVisualRule['themeMode']>('inherit')
  const [newVisualOverrideColors, setNewVisualOverrideColors] = useState(false)
  const [newVisualBg, setNewVisualBg] = useState('#7f8fff')
  const [newVisualText, setNewVisualText] = useState('#0d1a46')
  const [newVisualOverrideSize, setNewVisualOverrideSize] = useState(false)
  const [newVisualFontPx, setNewVisualFontPx] = useState(12)
  const [newVisualPadY, setNewVisualPadY] = useState(2)
  const [newVisualPadX, setNewVisualPadX] = useState(8)

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
      const res = (await chrome.runtime.sendMessage({ type: 'bb_refresh_rates' })) as {
        ok: boolean
        warning?: string
        error?: string
      }
      if (!res.ok) setStatus(`Refresh failed: ${res.error ?? 'unknown error'}`)
      else if (res.warning) setStatus(`Rates refreshed with fallback: ${res.warning}`)
      else setStatus('Rates refreshed.')
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
  const displayVisualRules = useMemo(() => [...(s.siteVisualRules ?? [])], [s.siteVisualRules])

  async function fillFromActiveTab(setter: (pattern: string) => void) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      const url = tab?.url
      if (!url) return
      const host = new URL(url).hostname
      if (!host) return
      setter(host)
    } catch {
      // ignore
    }
  }

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

              <label className="bb-label">
                <span>Размер текста (px)</span>
                <input
                  type="number"
                  min={9}
                  max={22}
                  step={1}
                  value={s.badgeFontSizePx}
                  onChange={(e) => void save({ ...s, badgeFontSizePx: Number(e.target.value) })}
                />
              </label>

              <label className="bb-label">
                <span>Padding Y (px)</span>
                <input
                  type="number"
                  min={0}
                  max={16}
                  step={1}
                  value={s.badgePaddingYpx}
                  onChange={(e) => void save({ ...s, badgePaddingYpx: Number(e.target.value) })}
                />
              </label>

              <label className="bb-label">
                <span>Padding X (px)</span>
                <input
                  type="number"
                  min={0}
                  max={24}
                  step={1}
                  value={s.badgePaddingXpx}
                  onChange={(e) => void save({ ...s, badgePaddingXpx: Number(e.target.value) })}
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

            <hr className="bb-hr" />

            <div className="bb-row">
              <div className="bb-muted">
                Per-site visuals: можно включать Auto theme только на выбранных сайтах и задавать свои цвета/размеры.
              </div>
            </div>

            <div className="bb-grid">
              <div className="bb-label">
                <span>Add visual override</span>
                <div className="bb-row" style={{ gap: 8 }}>
                  <select
                    value={newVisualThemeMode ?? 'inherit'}
                    onChange={(e) => setNewVisualThemeMode(e.target.value as SiteVisualRule['themeMode'])}
                  >
                    <option value="inherit">Inherit</option>
                    <option value="manual">Manual</option>
                    <option value="auto">Auto</option>
                  </select>
                  <input
                    style={{ flex: 1, minWidth: 220 }}
                    value={newVisualPattern}
                    onChange={(e) => setNewVisualPattern(e.target.value)}
                    placeholder="example.com"
                  />
                  <label className="bb-popup-line" style={{ minWidth: 140 }}>
                    <span>*.subdomains</span>
                    <input
                      type="checkbox"
                      checked={newVisualWildcard}
                      onChange={(e) => setNewVisualWildcard(e.target.checked)}
                    />
                  </label>
                  <button className="bb-btn" type="button" onClick={() => void fillFromActiveTab(setNewVisualPattern)}>
                    Current site
                  </button>
                  <button
                    className="bb-btn"
                    type="button"
                    onClick={() => {
                      const base = newVisualPattern.trim()
                      if (!base) return
                      const pattern = newVisualWildcard ? `*.${base.replace(/^\*\.\s*/, '')}` : base
                      const rule: SiteVisualRule = {
                        pattern,
                        themeMode: newVisualThemeMode ?? 'inherit',
                        ...(newVisualOverrideColors ? { badgeBgColor: newVisualBg, badgeTextColor: newVisualText } : {}),
                        ...(newVisualOverrideSize
                          ? {
                              badgeFontSizePx: newVisualFontPx,
                              badgePaddingYpx: newVisualPadY,
                              badgePaddingXpx: newVisualPadX,
                            }
                          : {}),
                      }
                      void save({ ...s, siteVisualRules: [rule, ...(s.siteVisualRules ?? [])] })
                      setNewVisualPattern('')
                    }}
                  >
                    Add
                  </button>
                </div>
                <div className="bb-row" style={{ marginTop: 8 }}>
                  <label className="bb-popup-line" style={{ minWidth: 180 }}>
                    <span>Override colors</span>
                    <input
                      type="checkbox"
                      checked={newVisualOverrideColors}
                      onChange={(e) => setNewVisualOverrideColors(e.target.checked)}
                    />
                  </label>
                  <input
                    type="color"
                    value={newVisualBg}
                    disabled={!newVisualOverrideColors || newVisualThemeMode === 'auto'}
                    onChange={(e) => setNewVisualBg(e.target.value)}
                  />
                  <input
                    type="color"
                    value={newVisualText}
                    disabled={!newVisualOverrideColors || newVisualThemeMode === 'auto'}
                    onChange={(e) => setNewVisualText(e.target.value)}
                  />

                  <label className="bb-popup-line" style={{ minWidth: 170 }}>
                    <span>Override size</span>
                    <input
                      type="checkbox"
                      checked={newVisualOverrideSize}
                      onChange={(e) => setNewVisualOverrideSize(e.target.checked)}
                    />
                  </label>
                  <input
                    type="number"
                    min={9}
                    max={22}
                    step={1}
                    value={newVisualFontPx}
                    disabled={!newVisualOverrideSize}
                    onChange={(e) => setNewVisualFontPx(Number(e.target.value))}
                    style={{ width: 90 }}
                  />
                  <input
                    type="number"
                    min={0}
                    max={16}
                    step={1}
                    value={newVisualPadY}
                    disabled={!newVisualOverrideSize}
                    onChange={(e) => setNewVisualPadY(Number(e.target.value))}
                    style={{ width: 90 }}
                  />
                  <input
                    type="number"
                    min={0}
                    max={24}
                    step={1}
                    value={newVisualPadX}
                    disabled={!newVisualOverrideSize}
                    onChange={(e) => setNewVisualPadX(Number(e.target.value))}
                    style={{ width: 90 }}
                  />
                </div>
              </div>

              <label className="bb-label">
                <span>Quick check (host)</span>
                <HostnameTester defaultMode={s.siteDefaultMode} rules={s.siteRules} enabledGlobal={s.enabled} />
              </label>
            </div>

            <div className="bb-ruleTable" style={{ marginTop: 10 }}>
              {displayVisualRules.length === 0 ? (
                <div className="bb-muted" style={{ padding: 12 }}>
                  No visual overrides yet.
                </div>
              ) : (
                displayVisualRules.map((r, idx) => (
                  <div className="bb-ruleRow" style={{ gridTemplateColumns: '120px 1fr 260px' }} key={`${r.pattern}:${idx}`}>
                    <div>
                      <span className="bb-pill">{(r.themeMode ?? 'inherit').toUpperCase()}</span>
                    </div>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <div
                        style={{
                          fontFamily:
                            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                        }}
                      >
                        {r.pattern}
                      </div>
                      <div className="bb-row" style={{ gap: 8 }}>
                        <select
                          value={r.themeMode ?? 'inherit'}
                          onChange={(e) => {
                            const next = [...(s.siteVisualRules ?? [])]
                            next[idx] = { ...next[idx], themeMode: e.target.value as SiteVisualRule['themeMode'] }
                            void save({ ...s, siteVisualRules: next })
                          }}
                        >
                          <option value="inherit">inherit</option>
                          <option value="manual">manual</option>
                          <option value="auto">auto</option>
                        </select>
                        <input
                          type="color"
                          value={r.badgeBgColor ?? s.badgeBgColor}
                          disabled={(r.themeMode ?? 'inherit') === 'auto'}
                          onChange={(e) => {
                            const next = [...(s.siteVisualRules ?? [])]
                            next[idx] = { ...next[idx], badgeBgColor: e.target.value }
                            void save({ ...s, siteVisualRules: next })
                          }}
                        />
                        <button
                          className="bb-btn"
                          type="button"
                          onClick={() => {
                            const next = [...(s.siteVisualRules ?? [])]
                            const { badgeBgColor, ...rest } = next[idx]
                            next[idx] = rest
                            void save({ ...s, siteVisualRules: next })
                          }}
                          disabled={r.badgeBgColor == null}
                        >
                          Clear
                        </button>

                        <input
                          type="color"
                          value={r.badgeTextColor ?? s.badgeTextColor}
                          disabled={(r.themeMode ?? 'inherit') === 'auto'}
                          onChange={(e) => {
                            const next = [...(s.siteVisualRules ?? [])]
                            next[idx] = { ...next[idx], badgeTextColor: e.target.value }
                            void save({ ...s, siteVisualRules: next })
                          }}
                        />
                        <button
                          className="bb-btn"
                          type="button"
                          onClick={() => {
                            const next = [...(s.siteVisualRules ?? [])]
                            const { badgeTextColor, ...rest } = next[idx]
                            next[idx] = rest
                            void save({ ...s, siteVisualRules: next })
                          }}
                          disabled={r.badgeTextColor == null}
                        >
                          Clear
                        </button>
                      </div>
                      <div className="bb-row" style={{ gap: 8 }}>
                        <input
                          type="number"
                          min={9}
                          max={22}
                          step={1}
                          value={r.badgeFontSizePx ?? s.badgeFontSizePx}
                          onChange={(e) => {
                            const next = [...(s.siteVisualRules ?? [])]
                            next[idx] = { ...next[idx], badgeFontSizePx: Number(e.target.value) }
                            void save({ ...s, siteVisualRules: next })
                          }}
                          style={{ width: 90 }}
                        />
                        <button
                          className="bb-btn"
                          type="button"
                          onClick={() => {
                            const next = [...(s.siteVisualRules ?? [])]
                            const { badgeFontSizePx, ...rest } = next[idx]
                            next[idx] = rest
                            void save({ ...s, siteVisualRules: next })
                          }}
                          disabled={r.badgeFontSizePx == null}
                        >
                          Clear
                        </button>

                        <input
                          type="number"
                          min={0}
                          max={16}
                          step={1}
                          value={r.badgePaddingYpx ?? s.badgePaddingYpx}
                          onChange={(e) => {
                            const next = [...(s.siteVisualRules ?? [])]
                            next[idx] = { ...next[idx], badgePaddingYpx: Number(e.target.value) }
                            void save({ ...s, siteVisualRules: next })
                          }}
                          style={{ width: 90 }}
                        />
                        <button
                          className="bb-btn"
                          type="button"
                          onClick={() => {
                            const next = [...(s.siteVisualRules ?? [])]
                            const { badgePaddingYpx, ...rest } = next[idx]
                            next[idx] = rest
                            void save({ ...s, siteVisualRules: next })
                          }}
                          disabled={r.badgePaddingYpx == null}
                        >
                          Clear
                        </button>

                        <input
                          type="number"
                          min={0}
                          max={24}
                          step={1}
                          value={r.badgePaddingXpx ?? s.badgePaddingXpx}
                          onChange={(e) => {
                            const next = [...(s.siteVisualRules ?? [])]
                            next[idx] = { ...next[idx], badgePaddingXpx: Number(e.target.value) }
                            void save({ ...s, siteVisualRules: next })
                          }}
                          style={{ width: 90 }}
                        />
                        <button
                          className="bb-btn"
                          type="button"
                          onClick={() => {
                            const next = [...(s.siteVisualRules ?? [])]
                            const { badgePaddingXpx, ...rest } = next[idx]
                            next[idx] = rest
                            void save({ ...s, siteVisualRules: next })
                          }}
                          disabled={r.badgePaddingXpx == null}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <div className="bb-row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                      <button
                        className="bb-btn bb-btnDanger"
                        type="button"
                        onClick={() => {
                          const next = [...(s.siteVisualRules ?? [])]
                          next.splice(idx, 1)
                          void save({ ...s, siteVisualRules: next })
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
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

