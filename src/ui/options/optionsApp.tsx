import { useEffect, useMemo, useState } from 'react'
import { DEFAULT_SETTINGS, getSettings, setSettings } from '../../shared/storage'
import {
  effectiveEnabledForSite,
  normalizeUserHostInput,
  removeRule,
  sortRulesForDisplay,
  upsertRule,
} from '../../shared/siteRules'
import { isLikelyBynHost } from '../../shared/hostCurrencyHeuristic'
import type {
  RateProvider,
  SiteVisualRule,
  TargetCurrency,
  UiThemeMode,
  UserSettings,
} from '../../shared/types'
import { BadgePreview } from '../components/BadgePreview'
import { IconButton } from '../components/IconButton'
import {
  IconAuto,
  IconChart,
  IconGlobe,
  IconLayers,
  IconMoon,
  IconPalette,
  IconPlus,
  IconRefresh,
  IconSettings,
  IconSun,
  IconTrash,
} from '../components/icons'
import { Segmented } from '../components/Segmented'
import { Section } from '../components/Section'
import { SwitchRow } from '../components/Switch'
import { Tabs } from '../components/Tabs'
import { applyUiThemeMode } from '../theme'

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/g)
    .map((s) => s.trim())
    .filter(Boolean)
}

function joinLines(value: string[]): string {
  return value.join('\n')
}

type TabId = 'general' | 'sites' | 'appearance' | 'tracker' | 'advanced'

export function OptionsApp() {
  const [loaded, setLoaded] = useState(false)
  const [s, setS] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [status, setStatus] = useState<string>('')
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<TabId>('general')
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
      applyUiThemeMode(settings.uiThemeMode)
      setLoaded(true)
    })
  }, [])

  // Re-apply UI theme whenever the user changes it.
  useEffect(() => {
    if (loaded) applyUiThemeMode(s.uiThemeMode)
  }, [loaded, s.uiThemeMode])

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
    setStatus('Сохранено')
    window.setTimeout(() => setStatus(''), 1200)
  }

  async function refreshRates() {
    setRefreshing(true)
    setStatus('Обновляю курс…')
    try {
      const res = (await chrome.runtime.sendMessage({ type: 'bb_refresh_rates' })) as {
        ok: boolean
        warning?: string
        error?: string
      }
      if (!res.ok) setStatus(`Ошибка: ${res.error ?? 'unknown'}`)
      else if (res.warning) setStatus(`Курс обновлён (fallback): ${res.warning}`)
      else setStatus('Курс обновлён')
    } catch (e) {
      setStatus(`Ошибка: ${String(e)}`)
    } finally {
      setRefreshing(false)
      window.setTimeout(() => setStatus(''), 1800)
    }
  }

  const providerOptions: { id: RateProvider; label: string }[] = [
    { id: 'NBRB', label: 'НБРБ (официальный)' },
    { id: 'BankAverage', label: 'Среднее по банкам (MVP)' },
    { id: 'BankBest', label: 'Лучшее по банкам (MVP)' },
    { id: 'BankSpecific', label: 'Беларусьбанк, Минск (MVP)' },
    { id: 'Custom', label: 'Custom (вручную)' },
  ]

  const currencyOptions: TargetCurrency[] = ['USD', 'EUR', 'PLN', 'RUB']
  const displayRules = useMemo(() => sortRulesForDisplay(s.siteRules), [s.siteRules])
  const displayVisualRules = useMemo(() => [...(s.siteVisualRules ?? [])], [s.siteVisualRules])

  async function fillFromActiveTab(setter: (pattern: string) => void) {
    try {
      const [tabInfo] = await chrome.tabs.query({ active: true, currentWindow: true })
      const url = tabInfo?.url
      if (!url) return
      const host = new URL(url).hostname
      if (!host) return
      setter(host)
    } catch {
      // ignore
    }
  }

  const themeOptions: { value: UiThemeMode; label: React.ReactNode; ariaLabel: string }[] = [
    { value: 'auto', label: <IconAuto />, ariaLabel: 'Авто (как в системе)' },
    { value: 'light', label: <IconSun />, ariaLabel: 'Светлая тема' },
    { value: 'dark', label: <IconMoon />, ariaLabel: 'Тёмная тема' },
  ]

  const tabItems: { value: TabId; label: string; icon: React.ReactNode }[] = [
    { value: 'general', label: 'Общее', icon: <IconSettings /> },
    { value: 'sites', label: 'Сайты', icon: <IconGlobe /> },
    { value: 'appearance', label: 'Внешний вид', icon: <IconPalette /> },
    { value: 'tracker', label: 'Трекер', icon: <IconChart /> },
    { value: 'advanced', label: 'Дополнительно', icon: <IconLayers /> },
  ]

  return (
    <div className="bb-page">
      {/* Page header */}
      <header className="bb-pageHeader">
        <div className="bb-brand">
          <div className="bb-brandMark">
            <span>Bb</span>
          </div>
          <div>
            <div className="bb-brandName">
              BelBucks
              <span className="bb-brandSub">Конвертер цен в Br</span>
            </div>
          </div>
        </div>
        <div className="bb-row">
          {status ? (
            <span className="bb-status">
              <span className="bb-statusDot" /> {status}
            </span>
          ) : null}
          <Segmented<UiThemeMode>
            ariaLabel="Тема интерфейса"
            value={s.uiThemeMode}
            options={themeOptions}
            onChange={(v) => void save({ ...s, uiThemeMode: v })}
          />
        </div>
      </header>

      {!loaded ? (
        <p className="bb-muted">Загрузка…</p>
      ) : (
        <>
          <Tabs<TabId> ariaLabel="Разделы настроек" items={tabItems} value={tab} onChange={setTab} />

          {tab === 'general' ? (
            <div className="bb-tabPanel">
              <Section
                title="СОСТОЯНИЕ"
                aside={
                  <IconButton
                    ariaLabel="Обновить курс"
                    spinning={refreshing}
                    onClick={() => void refreshRates()}
                  >
                    <IconRefresh />
                  </IconButton>
                }
              >
                <SwitchRow
                  title="Расширение включено"
                  description="Главный выключатель — выключить и расширение перестанет работать на всех сайтах."
                  checked={s.enabled}
                  onChange={(v) => void save({ ...s, enabled: v })}
                />
              </Section>

              <Section title="ВАЛЮТА" description="В какие валюты конвертировать BYN.">
                <div className="bb-field">
                  <span className="bb-field__label">Основная валюта</span>
                  <Segmented<TargetCurrency>
                    block
                    ariaLabel="Основная валюта"
                    value={s.targetCurrency}
                    options={currencyOptions.map((c) => ({ value: c, label: c }))}
                    onChange={(v) => void save({ ...s, targetCurrency: v })}
                  />
                </div>
                <div className="bb-grid">
                  <label className="bb-label">
                    <span>Вторая валюта (опционально)</span>
                    <select
                      value={s.secondaryCurrency}
                      onChange={(e) =>
                        void save({
                          ...s,
                          secondaryCurrency: e.target.value as UserSettings['secondaryCurrency'],
                        })
                      }
                    >
                      <option value="NONE">— нет</option>
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
                      onChange={(e) =>
                        void save({ ...s, rateProvider: e.target.value as RateProvider })
                      }
                    >
                      {providerOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="bb-label">
                  <span>
                    Наценка банка: <strong className="bb-num">{s.markupPercent.toFixed(1)}%</strong>{' '}
                    <span className="bb-subtle">— добавляется к курсу</span>
                  </span>
                  <input
                    type="range"
                    min={-5}
                    max={10}
                    step={0.1}
                    value={s.markupPercent}
                    style={
                      {
                        ['--bb-range-pct' as string]: `${((s.markupPercent + 5) / 15) * 100}%`,
                      } as React.CSSProperties
                    }
                    onChange={(e) => void save({ ...s, markupPercent: Number(e.target.value) })}
                  />
                </label>
              </Section>

              <Section title="РЕЖИМ ОТОБРАЖЕНИЯ">
                <div className="bb-field">
                  <span className="bb-field__label">Где показывать конвертацию</span>
                  <Segmented<UserSettings['displayMode']>
                    block
                    ariaLabel="Режим отображения"
                    value={s.displayMode}
                    options={[
                      { value: 'inline', label: 'Inline (рядом с ценой)' },
                      { value: 'tooltip', label: 'Tooltip (по наведению)' },
                    ]}
                    onChange={(v) => void save({ ...s, displayMode: v })}
                  />
                  <span className="bb-field__hint">
                    «Inline» — добавляет бейдж рядом с каждой ценой. «Tooltip» — показывает значение
                    только при наведении.
                  </span>
                </div>
              </Section>
            </div>
          ) : null}

          {tab === 'sites' ? (
            <div className="bb-tabPanel">
              <Section
                title="ПО УМОЛЧАНИЮ"
                description="Поведение для сайтов, которые не указаны явно ниже."
              >
                <Segmented<UserSettings['siteDefaultMode']>
                  block
                  ariaLabel="Default behavior"
                  value={s.siteDefaultMode}
                  options={[
                    { value: 'enabledEverywhere', label: 'Везде включено' },
                    { value: 'disabledEverywhere', label: 'Везде выключено' },
                  ]}
                  onChange={(v) => void save({ ...s, siteDefaultMode: v })}
                />
              </Section>

              <Section title="ДОБАВИТЬ ПРАВИЛО">
                <div className="bb-row" style={{ gap: 8 }}>
                  <Segmented<'allow' | 'block'>
                    ariaLabel="Тип правила"
                    value={newRuleMode}
                    options={[
                      { value: 'allow', label: 'Allow' },
                      { value: 'block', label: 'Block' },
                    ]}
                    onChange={setNewRuleMode}
                  />
                  <input
                    style={{ flex: 1, minWidth: 180 }}
                    value={newRulePattern}
                    onChange={(e) => setNewRulePattern(e.target.value)}
                    placeholder="example.com"
                  />
                  <label
                    className="bb-row"
                    style={{ gap: 6, fontSize: 12, color: 'var(--bb-text-muted)' }}
                  >
                    <input
                      type="checkbox"
                      checked={newRuleWildcard}
                      onChange={(e) => setNewRuleWildcard(e.target.checked)}
                    />
                    <span>*.поддомены</span>
                  </label>
                  <button
                    className="bb-btn"
                    type="button"
                    onClick={() => void fillFromActiveTab(setNewRulePattern)}
                  >
                    Текущая
                  </button>
                  <button
                    className="bb-btn bb-btn--primary"
                    type="button"
                    onClick={() => {
                      const base = normalizeUserHostInput(newRulePattern)
                      if (!base) return
                      const pattern = newRuleWildcard
                        ? `*.${base.replace(/^\*\.\s*/, '')}`
                        : base
                      void save({
                        ...s,
                        siteRules: upsertRule(s.siteRules, { pattern, mode: newRuleMode }),
                      })
                      setNewRulePattern('')
                    }}
                  >
                    <IconPlus /> Добавить
                  </button>
                </div>
                <NormalizedHostHint
                  raw={newRulePattern}
                  wildcard={newRuleWildcard}
                />
              </Section>

              <Section
                title="ПРАВИЛА"
                description={`${displayRules.length} ${
                  displayRules.length === 1 ? 'правило' : 'правил'
                }`}
              >
                <div className="bb-ruleTable">
                  {displayRules.length === 0 ? (
                    <div className="bb-empty">Пока нет правил.</div>
                  ) : (
                    displayRules.map((r) => (
                      <div className="bb-ruleRow" key={`${r.mode}:${r.pattern}`}>
                        <span
                          className={`bb-pill ${
                            r.mode === 'allow' ? 'bb-pillAllow' : 'bb-pillBlock'
                          }`}
                        >
                          {r.mode === 'allow' ? 'Allow' : 'Block'}
                        </span>
                        <div className="bb-ruleRow__pattern">{r.pattern}</div>
                        <div className="bb-row" style={{ gap: 6 }}>
                          <button
                            className="bb-btn bb-btn--soft bb-btn--sm"
                            type="button"
                            onClick={() =>
                              void save({
                                ...s,
                                siteRules: upsertRule(s.siteRules, {
                                  pattern: r.pattern,
                                  mode: r.mode === 'allow' ? 'block' : 'allow',
                                }),
                              })
                            }
                          >
                            Переключить
                          </button>
                          <button
                            className="bb-btn bb-btn--danger bb-btn--sm"
                            type="button"
                            onClick={() =>
                              void save({ ...s, siteRules: removeRule(s.siteRules, r.pattern) })
                            }
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Section>

              <Section title="БЫСТРАЯ ПРОВЕРКА" description="Проверь, что правила работают.">
                <HostnameTester
                  defaultMode={s.siteDefaultMode}
                  rules={s.siteRules}
                  enabledGlobal={s.enabled}
                />
              </Section>

              <Section
                title="ВИЗУАЛЬНЫЕ ПЕРЕОПРЕДЕЛЕНИЯ"
                description="Свои цвета и размер бейджа для конкретных сайтов."
              >
                <div className="bb-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <select
                    value={newVisualThemeMode ?? 'inherit'}
                    onChange={(e) =>
                      setNewVisualThemeMode(e.target.value as SiteVisualRule['themeMode'])
                    }
                  >
                    <option value="inherit">Тема: inherit</option>
                    <option value="manual">Тема: manual</option>
                    <option value="auto">Тема: auto</option>
                  </select>
                  <input
                    style={{ flex: 1, minWidth: 180 }}
                    value={newVisualPattern}
                    onChange={(e) => setNewVisualPattern(e.target.value)}
                    placeholder="example.com"
                  />
                  <label
                    className="bb-row"
                    style={{ gap: 6, fontSize: 12, color: 'var(--bb-text-muted)' }}
                  >
                    <input
                      type="checkbox"
                      checked={newVisualWildcard}
                      onChange={(e) => setNewVisualWildcard(e.target.checked)}
                    />
                    <span>*.поддомены</span>
                  </label>
                  <button
                    className="bb-btn"
                    type="button"
                    onClick={() => void fillFromActiveTab(setNewVisualPattern)}
                  >
                    Текущая
                  </button>
                  <button
                    className="bb-btn bb-btn--primary"
                    type="button"
                    onClick={() => {
                      const base = normalizeUserHostInput(newVisualPattern)
                      if (!base) return
                      const pattern = newVisualWildcard
                        ? `*.${base.replace(/^\*\.\s*/, '')}`
                        : base
                      const rule: SiteVisualRule = {
                        pattern,
                        themeMode: newVisualThemeMode ?? 'inherit',
                        ...(newVisualOverrideColors
                          ? { badgeBgColor: newVisualBg, badgeTextColor: newVisualText }
                          : {}),
                        ...(newVisualOverrideSize
                          ? {
                              badgeFontSizePx: newVisualFontPx,
                              badgePaddingYpx: newVisualPadY,
                              badgePaddingXpx: newVisualPadX,
                            }
                          : {}),
                      }
                      void save({
                        ...s,
                        siteVisualRules: [rule, ...(s.siteVisualRules ?? [])],
                      })
                      setNewVisualPattern('')
                    }}
                  >
                    <IconPlus /> Добавить
                  </button>
                </div>
                <NormalizedHostHint
                  raw={newVisualPattern}
                  wildcard={newVisualWildcard}
                />
                <div className="bb-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <label
                    className="bb-row"
                    style={{ gap: 6, fontSize: 12, color: 'var(--bb-text-muted)' }}
                  >
                    <input
                      type="checkbox"
                      checked={newVisualOverrideColors}
                      onChange={(e) => setNewVisualOverrideColors(e.target.checked)}
                    />
                    <span>Свои цвета</span>
                  </label>
                  <input
                    type="color"
                    value={newVisualBg}
                    disabled={!newVisualOverrideColors || newVisualThemeMode === 'auto'}
                    onChange={(e) => setNewVisualBg(e.target.value)}
                    style={{ width: 64 }}
                  />
                  <input
                    type="color"
                    value={newVisualText}
                    disabled={!newVisualOverrideColors || newVisualThemeMode === 'auto'}
                    onChange={(e) => setNewVisualText(e.target.value)}
                    style={{ width: 64 }}
                  />
                  <label
                    className="bb-row"
                    style={{ gap: 6, fontSize: 12, color: 'var(--bb-text-muted)' }}
                  >
                    <input
                      type="checkbox"
                      checked={newVisualOverrideSize}
                      onChange={(e) => setNewVisualOverrideSize(e.target.checked)}
                    />
                    <span>Свой размер</span>
                  </label>
                  <input
                    type="number"
                    min={9}
                    max={22}
                    step={1}
                    value={newVisualFontPx}
                    disabled={!newVisualOverrideSize}
                    onChange={(e) => setNewVisualFontPx(Number(e.target.value))}
                    style={{ width: 80 }}
                  />
                  <input
                    type="number"
                    min={0}
                    max={16}
                    step={1}
                    value={newVisualPadY}
                    disabled={!newVisualOverrideSize}
                    onChange={(e) => setNewVisualPadY(Number(e.target.value))}
                    style={{ width: 80 }}
                  />
                  <input
                    type="number"
                    min={0}
                    max={24}
                    step={1}
                    value={newVisualPadX}
                    disabled={!newVisualOverrideSize}
                    onChange={(e) => setNewVisualPadX(Number(e.target.value))}
                    style={{ width: 80 }}
                  />
                </div>

                <div className="bb-ruleTable" style={{ marginTop: 4 }}>
                  {displayVisualRules.length === 0 ? (
                    <div className="bb-empty">Нет визуальных переопределений.</div>
                  ) : (
                    displayVisualRules.map((r, idx) => (
                      <div
                        className="bb-ruleRow"
                        style={{ gridTemplateColumns: '110px 1fr auto' }}
                        key={`${r.pattern}:${idx}`}
                      >
                        <span className="bb-pill">
                          {(r.themeMode ?? 'inherit').toUpperCase()}
                        </span>
                        <div style={{ display: 'grid', gap: 6 }}>
                          <div className="bb-ruleRow__pattern">{r.pattern}</div>
                          <div className="bb-row" style={{ gap: 6 }}>
                            <select
                              value={r.themeMode ?? 'inherit'}
                              onChange={(e) => {
                                const next = [...(s.siteVisualRules ?? [])]
                                next[idx] = {
                                  ...next[idx],
                                  themeMode: e.target.value as SiteVisualRule['themeMode'],
                                }
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
                              style={{ width: 48 }}
                            />
                            <input
                              type="color"
                              value={r.badgeTextColor ?? s.badgeTextColor}
                              disabled={(r.themeMode ?? 'inherit') === 'auto'}
                              onChange={(e) => {
                                const next = [...(s.siteVisualRules ?? [])]
                                next[idx] = { ...next[idx], badgeTextColor: e.target.value }
                                void save({ ...s, siteVisualRules: next })
                              }}
                              style={{ width: 48 }}
                            />
                            <input
                              type="number"
                              min={9}
                              max={22}
                              step={1}
                              value={r.badgeFontSizePx ?? s.badgeFontSizePx}
                              onChange={(e) => {
                                const next = [...(s.siteVisualRules ?? [])]
                                next[idx] = {
                                  ...next[idx],
                                  badgeFontSizePx: Number(e.target.value),
                                }
                                void save({ ...s, siteVisualRules: next })
                              }}
                              style={{ width: 70 }}
                            />
                            <input
                              type="number"
                              min={0}
                              max={16}
                              step={1}
                              value={r.badgePaddingYpx ?? s.badgePaddingYpx}
                              onChange={(e) => {
                                const next = [...(s.siteVisualRules ?? [])]
                                next[idx] = {
                                  ...next[idx],
                                  badgePaddingYpx: Number(e.target.value),
                                }
                                void save({ ...s, siteVisualRules: next })
                              }}
                              style={{ width: 70 }}
                            />
                            <input
                              type="number"
                              min={0}
                              max={24}
                              step={1}
                              value={r.badgePaddingXpx ?? s.badgePaddingXpx}
                              onChange={(e) => {
                                const next = [...(s.siteVisualRules ?? [])]
                                next[idx] = {
                                  ...next[idx],
                                  badgePaddingXpx: Number(e.target.value),
                                }
                                void save({ ...s, siteVisualRules: next })
                              }}
                              style={{ width: 70 }}
                            />
                          </div>
                        </div>
                        <button
                          className="bb-btn bb-btn--danger bb-btn--sm"
                          type="button"
                          onClick={() => {
                            const next = [...(s.siteVisualRules ?? [])]
                            next.splice(idx, 1)
                            void save({ ...s, siteVisualRules: next })
                          }}
                        >
                          <IconTrash />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </Section>
            </div>
          ) : null}

          {tab === 'appearance' ? (
            <div className="bb-tabPanel">
              <Section
                title="ПРЕВЬЮ"
                description="Так бейдж выглядит на странице с текущими настройками."
              >
                <BadgePreview
                  bg={s.badgeBgColor}
                  fg={s.badgeTextColor}
                  fontSizePx={s.badgeFontSizePx}
                  paddingYpx={s.badgePaddingYpx}
                  paddingXpx={s.badgePaddingXpx}
                  currency={s.targetCurrency}
                  rate={s.customRates?.[s.targetCurrency] ?? 3.25}
                  bynPrice={199.99}
                />
              </Section>

              <Section title="АВТО ТЕМА">
                <SwitchRow
                  title="Подбирать цвета под сайт"
                  description="На av.by — синий, на onliner.by — жёлтый, и т.д. Если выключено — используются твои цвета."
                  checked={s.badgeThemeMode === 'auto'}
                  onChange={(v) =>
                    void save({ ...s, badgeThemeMode: v ? 'auto' : 'manual' })
                  }
                />
              </Section>

              <Section
                title="ЦВЕТА"
                description={
                  s.badgeThemeMode === 'auto'
                    ? 'Auto-тема активна — твои цвета не применяются. Чтобы их использовать, выключи переключатель выше.'
                    : 'Используются на всех сайтах кроме тех, где задано визуальное переопределение.'
                }
              >
                <div className="bb-grid">
                  <label className="bb-label">
                    <span>Цвет фона бейджа</span>
                    <input
                      type="color"
                      value={s.badgeBgColor}
                      disabled={s.badgeThemeMode === 'auto'}
                      onChange={(e) => void save({ ...s, badgeBgColor: e.target.value })}
                    />
                  </label>
                  <label className="bb-label">
                    <span>Цвет текста</span>
                    <input
                      type="color"
                      value={s.badgeTextColor}
                      disabled={s.badgeThemeMode === 'auto'}
                      onChange={(e) => void save({ ...s, badgeTextColor: e.target.value })}
                    />
                  </label>
                </div>
              </Section>

              <Section title="РАЗМЕР">
                <div className="bb-grid">
                  <label className="bb-label">
                    <span>
                      Размер шрифта: <strong className="bb-num">{s.badgeFontSizePx}px</strong>
                    </span>
                    <input
                      type="range"
                      min={9}
                      max={22}
                      step={1}
                      value={s.badgeFontSizePx}
                      style={
                        {
                          ['--bb-range-pct' as string]: `${
                            ((s.badgeFontSizePx - 9) / 13) * 100
                          }%`,
                        } as React.CSSProperties
                      }
                      onChange={(e) =>
                        void save({ ...s, badgeFontSizePx: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="bb-label">
                    <span>
                      Padding по вертикали:{' '}
                      <strong className="bb-num">{s.badgePaddingYpx}px</strong>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={16}
                      step={1}
                      value={s.badgePaddingYpx}
                      style={
                        {
                          ['--bb-range-pct' as string]: `${(s.badgePaddingYpx / 16) * 100}%`,
                        } as React.CSSProperties
                      }
                      onChange={(e) =>
                        void save({ ...s, badgePaddingYpx: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="bb-label" style={{ gridColumn: '1 / -1' }}>
                    <span>
                      Padding по горизонтали:{' '}
                      <strong className="bb-num">{s.badgePaddingXpx}px</strong>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={24}
                      step={1}
                      value={s.badgePaddingXpx}
                      style={
                        {
                          ['--bb-range-pct' as string]: `${(s.badgePaddingXpx / 24) * 100}%`,
                        } as React.CSSProperties
                      }
                      onChange={(e) =>
                        void save({ ...s, badgePaddingXpx: Number(e.target.value) })
                      }
                    />
                  </label>
                </div>
              </Section>
            </div>
          ) : null}

          {tab === 'tracker' ? (
            <div className="bb-tabPanel">
              <Section
                title="ИСТОРИЯ ЦЕН"
                description="История цен товара. Данные хранятся локально в браузере, никуда не отправляются."
              >
                <SwitchRow
                  title="Записывать историю цен"
                  description="Каждое посещение страницы товара сохраняет точку в локальной истории."
                  checked={s.priceTrackerEnabled}
                  onChange={(v) =>
                    void save({ ...s, priceTrackerEnabled: v, priceTrackerAcknowledged: true })
                  }
                />
                <SwitchRow
                  title="Опт-ин подтверждён"
                  description="Если выключить — при следующем открытии popup'а покажется баннер с предложением включить трекер."
                  checked={!!s.priceTrackerAcknowledged}
                  onChange={(v) => void save({ ...s, priceTrackerAcknowledged: v })}
                />
              </Section>

              <Section
                title="ОЧИСТКА"
                description="История хранится в chrome.storage.local. Чтобы очистить всё — нажми ниже."
              >
                <div className="bb-row">
                  <button
                    className="bb-btn bb-btn--danger"
                    type="button"
                    onClick={() => {
                      if (!confirm('Удалить всю историю цен?')) return
                      void chrome.storage.local
                        .remove('belbucks_price_history')
                        .then(() => setStatus('История очищена'))
                    }}
                  >
                    <IconTrash /> Удалить всю историю
                  </button>
                </div>
              </Section>
            </div>
          ) : null}

          {tab === 'advanced' ? (
            <div className="bb-tabPanel">
              {s.rateProvider === 'Custom' ? (
                <Section
                  title="CUSTOM КУРС"
                  description="1 TARGET = X BYN. Применяется только когда источник курса = Custom."
                >
                  <div className="bb-grid">
                    {currencyOptions.map((c) => (
                      <label className="bb-label" key={c}>
                        <span>
                          1 {c} = <span className="bb-mono">X</span> BYN
                        </span>
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
                </Section>
              ) : (
                <Section
                  title="CUSTOM КУРС"
                  description="Чтобы задать курс вручную — выбери в «Общее» источник курса 'Custom'."
                >
                  <div className="bb-empty">Сейчас источник: {s.rateProvider}</div>
                </Section>
              )}

              <Section title="LEGACY СПИСКИ">
                <div className="bb-row">
                  <button
                    className="bb-btn bb-btn--soft"
                    type="button"
                    onClick={() => setShowLegacy((v) => !v)}
                  >
                    {showLegacy ? 'Скрыть legacy списки' : 'Показать legacy списки'}
                  </button>
                  <button
                    className="bb-btn"
                    type="button"
                    onClick={() => {
                      const rules = [
                        ...s.blacklistDomains.map((d) => ({
                          pattern: d.trim(),
                          mode: 'block' as const,
                        })),
                        ...s.whitelistDomains.map((d) => ({
                          pattern: d.trim(),
                          mode: 'allow' as const,
                        })),
                      ]
                      if (rules.length === 0) return
                      let next = s.siteRules
                      for (const rr of rules) next = upsertRule(next, rr)
                      void save({ ...s, siteRules: next })
                    }}
                  >
                    Импорт legacy → правила
                  </button>
                </div>
                {showLegacy ? (
                  <div className="bb-grid" style={{ marginTop: 8 }}>
                    <SwitchRow
                      title="Использовать только whitelist (legacy)"
                      checked={s.useWhitelistOnly}
                      onChange={(v) => void save({ ...s, useWhitelistOnly: v })}
                    />
                    <div />
                    <label className="bb-label">
                      <span>Whitelist (1 домен на строку)</span>
                      <textarea
                        rows={6}
                        value={joinLines(s.whitelistDomains)}
                        onChange={(e) =>
                          void save({ ...s, whitelistDomains: splitLines(e.target.value) })
                        }
                      />
                    </label>
                    <label className="bb-label">
                      <span>Blacklist (1 домен на строку)</span>
                      <textarea
                        rows={6}
                        value={joinLines(s.blacklistDomains)}
                        onChange={(e) =>
                          void save({ ...s, blacklistDomains: splitLines(e.target.value) })
                        }
                      />
                    </label>
                  </div>
                ) : null}
              </Section>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

function HostnameTester(props: {
  enabledGlobal: boolean
  defaultMode: UserSettings['siteDefaultMode']
  rules: UserSettings['siteRules']
}) {
  const [host, setHost] = useState('catalog.onliner.by')
  // The tester always evaluates against the *normalized* hostname so it
  // behaves the same way the content-script does at scan time. Pasting a
  // full URL here now resolves to the matching host, not a literal string.
  const resolved = normalizeUserHostInput(host)
  const enabled = effectiveEnabledForSite({
    enabledGlobal: props.enabledGlobal,
    host: resolved,
    defaultMode: props.defaultMode,
    rules: props.rules,
  })
  // When a foreign TLD is gated by the heuristic and the user has no explicit
  // rule for it, we want to be loud about WHY — otherwise it looks like the
  // tester is bugged when someone types e.g. `kwork.ru` and gets DISABLED.
  const looksForeign = resolved ? !isLikelyBynHost(resolved) : false

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div className="bb-row" style={{ gap: 8 }}>
        <input
          value={host}
          onChange={(e) => setHost(e.target.value)}
          placeholder="example.com"
          style={{ flex: 1, minWidth: 200 }}
        />
        <span className={`bb-pill ${enabled ? 'bb-pillAllow' : 'bb-pillBlock'}`}>
          {enabled ? 'ENABLED' : 'DISABLED'}
        </span>
      </div>
      {resolved && resolved !== host.trim().toLowerCase() ? (
        <div className="bb-muted" style={{ fontSize: 12 }}>
          интерпретируется как <code>{resolved}</code>
        </div>
      ) : null}
      {looksForeign ? (
        <div className="bb-muted" style={{ fontSize: 12 }}>
          {!enabled
            ? 'TLD не похож на BY — расширение здесь по умолчанию выключено. Чтобы заставить — добавь правило «Разрешить» выше.'
            : 'TLD не похож на BY, но включено явным правилом.'}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Renders a small "будет сохранено как: <host>" hint below an "Add rule"
 * input. Only shows up when normalization actually changes the user's input,
 * so a clean "kwork.ru" doesn't get a redundant echo.
 */
function NormalizedHostHint(props: { raw: string; wildcard: boolean }) {
  const base = normalizeUserHostInput(props.raw)
  if (!base) return null
  const final = props.wildcard ? `*.${base.replace(/^\*\.\s*/, '')}` : base
  if (final === props.raw.trim().toLowerCase()) return null
  return (
    <div className="bb-muted" style={{ fontSize: 12, marginTop: 6 }}>
      будет сохранено как <code>{final}</code>
    </div>
  )
}
