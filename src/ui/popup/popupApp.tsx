import { useEffect, useMemo, useState } from 'react'
import type { PriceHistoryEntry } from '../../shared/priceTracker'
import { clearPriceHistoryForUrl, loadPriceHistory } from '../../shared/priceTracker'
import { getRatesCache, getSettings, setSettings } from '../../shared/storage'
import { isEnabledForSite, upsertHostRule } from '../../shared/siteRules'
import type { RatesCache, RateProvider, TargetCurrency, UserSettings } from '../../shared/types'
import { IconButton } from '../components/IconButton'
import {
  IconChart,
  IconClose,
  IconExternal,
  IconRefresh,
  IconSettings,
  IconTag,
  IconTarget,
  IconTrash,
} from '../components/icons'
import { Segmented } from '../components/Segmented'
import { Section } from '../components/Section'
import { Switch, SwitchRow } from '../components/Switch'

function formatTime(t: number): string {
  return new Date(t).toLocaleString()
}

function formatRelative(now: number, then: number): string {
  const diff = Math.max(0, now - then)
  const sec = Math.round(diff / 1000)
  if (sec < 60) return 'только что'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min} мин назад`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr} ч назад`
  const d = Math.round(hr / 24)
  return `${d} дн назад`
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
    const w = 280
    const h = 36
    return points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * w
        const y = h - ((p.byn - min) / span) * h
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }, [points])

  return (
    <svg
      className="bb-spark"
      width="100%"
      height="36"
      viewBox="0 0 280 36"
      preserveAspectRatio="none"
      style={{ display: 'block' }}
    >
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" opacity="0.9" />
    </svg>
  )
}

const PROVIDER_LABEL: Record<RateProvider, string> = {
  NBRB: 'НБРБ',
  BankAverage: 'Среднее по банкам',
  BankBest: 'Лучшее по банкам',
  BankSpecific: 'Конкретный банк',
  Custom: 'Custom',
}

type PickerRole = 'currentPrice' | 'productPrice' | 'oldPrice' | 'installment' | 'notAPrice'

export function PopupApp() {
  const [entry, setEntry] = useState<PriceHistoryEntry | null>(null)
  const [err, setErr] = useState<string>('')
  const [settings, setSettingsState] = useState<UserSettings | null>(null)
  const [rates, setRates] = useState<RatesCache | null>(null)
  const [status, setStatus] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [activeHost, setActiveHost] = useState<string>('')
  const [activeUrl, setActiveUrl] = useState<string>('')

  useEffect(() => {
    async function load() {
      setErr('')
      try {
        const [s, ratesCache] = await Promise.all([getSettings(), getRatesCache()])
        setSettingsState(s)
        setRates(ratesCache)

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

        // Fallback: same origin+pathname (ignore query-string changes).
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
    setRefreshing(true)
    setStatus('Обновляю…')
    try {
      const res = (await chrome.runtime.sendMessage({ type: 'bb_refresh_rates' })) as {
        ok: boolean
        warning?: string
        error?: string
      }
      if (!res.ok) setStatus('Не удалось')
      else if (res.warning) setStatus('Курс обновлён (fallback)')
      else setStatus('Курс обновлён')
      setRates(await getRatesCache())
    } catch {
      setStatus('Не удалось')
    } finally {
      setRefreshing(false)
      window.setTimeout(() => setStatus(''), 1500)
    }
  }

  async function resetCurrentPageHistory() {
    if (!activeUrl) return
    setStatus('Очищаю историю…')
    try {
      const removed = await clearPriceHistoryForUrl(activeUrl)
      setEntry(null)
      setStatus(removed > 0 ? 'История очищена' : 'Нечего очищать')
    } catch {
      setStatus('Ошибка')
    } finally {
      window.setTimeout(() => setStatus(''), 1400)
    }
  }

  async function startPickerForRole(role: PickerRole) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) {
      setStatus('Нет активной вкладки')
      window.setTimeout(() => setStatus(''), 1400)
      return
    }
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'bb_start_picker', role })
      setStatus('Кликни элемент на странице…')
      window.close()
    } catch {
      setStatus('Picker недоступен здесь')
      window.setTimeout(() => setStatus(''), 1800)
    }
  }

  const currencyOptions: TargetCurrency[] = ['USD', 'EUR', 'PLN', 'RUB']
  const providerOptions: { id: RateProvider; label: string }[] = [
    { id: 'NBRB', label: 'НБРБ' },
    { id: 'BankAverage', label: 'Среднее' },
    { id: 'BankBest', label: 'Лучшее' },
    { id: 'BankSpecific', label: 'Беларусьбанк' },
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
  const showTrackerBanner = !!settings && !settings.priceTrackerAcknowledged
  const trackerOn = !!settings?.priceTrackerEnabled

  const liveRate = useMemo(() => {
    if (!settings || !rates) return null
    const v = rates.bynPerTarget[settings.targetCurrency]
    if (!Number.isFinite(v) || v <= 0) return null
    return v
  }, [settings, rates])

  if (!settings) {
    return (
      <div className="bb-popup">
        <div className="bb-popup__header">
          <span className="bb-brand">
            <span className="bb-brandMark">
              <span>Bb</span>
            </span>
            <span className="bb-popup__title">
              <strong>BelBucks</strong>
              <small>загрузка…</small>
            </span>
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="bb-popup">
      {/* Header */}
      <header className="bb-popup__header">
        <span className="bb-brand">
          <span className="bb-brandMark">
            <span>Bb</span>
          </span>
          <span className="bb-popup__title">
            <strong>BelBucks</strong>
            <small>{activeHost || 'Открытая вкладка'}</small>
          </span>
        </span>
        <Switch
          checked={settings.enabled}
          onChange={(v) => void save({ ...settings, enabled: v })}
          ariaLabel="Глобально включить расширение"
        />
      </header>

      {/* Rate snapshot */}
      <Section
        title="КУРС"
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
        <div className="bb-popup__rateLine">
          <span className="bb-popup__rateValue">
            {liveRate ? (
              <>
                1&nbsp;{settings.targetCurrency} = {liveRate.toFixed(4)} BYN
              </>
            ) : (
              '—'
            )}
          </span>
          <span className="bb-popup__rateMeta">
            {rates
              ? `${PROVIDER_LABEL[rates.provider] ?? rates.provider} · ${formatRelative(
                  Date.now(),
                  rates.fetchedAt,
                )}`
              : 'нет данных'}
          </span>
        </div>
      </Section>

      {/* Tracker opt-in banner */}
      {showTrackerBanner ? (
        <div className="bb-banner" role="region" aria-label="Согласие на трекер цен">
          <div className="bb-banner__title">
            <IconChart /> История цен
          </div>
          <div className="bb-banner__desc">
            Записывать историю цен для просмотра. Данные хранятся <strong>локально</strong>, никуда не
            отправляются.
          </div>
          <div className="bb-banner__actions">
            <button
              className="bb-btn bb-btn--primary bb-btn--sm"
              type="button"
              onClick={() =>
                void save({ ...settings, priceTrackerEnabled: true, priceTrackerAcknowledged: true })
              }
            >
              Включить
            </button>
            <button
              className="bb-btn bb-btn--soft bb-btn--sm"
              type="button"
              onClick={() =>
                void save({ ...settings, priceTrackerEnabled: false, priceTrackerAcknowledged: true })
              }
            >
              Не сейчас
            </button>
          </div>
        </div>
      ) : null}

      {/* This site */}
      {activeHost ? (
        <Section title="ЭТОТ САЙТ">
          <SwitchRow
            title={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <IconTarget /> Конвертировать здесь
              </span>
            }
            description={activeHost}
            checked={!!enabledForThisSite}
            onChange={(v) => {
              const nextRules = upsertHostRule(settings.siteRules, activeHost, v ? 'allow' : 'block')
              void save({ ...settings, siteRules: nextRules })
            }}
          />
        </Section>
      ) : null}

      {/* Conversion */}
      <Section title="КОНВЕРТАЦИЯ">
        <div className="bb-field">
          <span className="bb-field__label">Основная валюта</span>
          <Segmented<TargetCurrency>
            block
            ariaLabel="Основная валюта"
            value={settings.targetCurrency}
            options={currencyOptions.map((c) => ({ value: c, label: c }))}
            onChange={(v) => void save({ ...settings, targetCurrency: v })}
          />
        </div>
        <div className="bb-grid">
          <label className="bb-label">
            <span>Вторая валюта</span>
            <select
              value={settings.secondaryCurrency}
              onChange={(e) =>
                void save({
                  ...settings,
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
        </div>
      </Section>

      {/* Picker */}
      <Section
        title="РАЗМЕТКА ЦЕНЫ"
        description="Если бейдж не в том месте — кликни роль и ткни элемент на странице."
      >
        <div className="bb-pickerGrid">
          <button
            className="bb-pickerBtn bb-pickerBtn--current"
            type="button"
            onClick={() => void startPickerForRole('currentPrice')}
          >
            <span className="bb-pickerBtn__dot" />
            Цена
          </button>
          <button
            className="bb-pickerBtn bb-pickerBtn--product"
            type="button"
            onClick={() => void startPickerForRole('productPrice')}
          >
            <span className="bb-pickerBtn__dot" />
            Цена товара
          </button>
          <button
            className="bb-pickerBtn bb-pickerBtn--old"
            type="button"
            onClick={() => void startPickerForRole('oldPrice')}
          >
            <span className="bb-pickerBtn__dot" />
            Старая
          </button>
          <button
            className="bb-pickerBtn bb-pickerBtn--installment"
            type="button"
            onClick={() => void startPickerForRole('installment')}
          >
            <span className="bb-pickerBtn__dot" />
            Рассрочка
          </button>
          <button
            className="bb-pickerBtn bb-pickerBtn--not"
            type="button"
            style={{ gridColumn: '1 / -1' }}
            onClick={() => void startPickerForRole('notAPrice')}
          >
            <IconClose /> Это не цена
          </button>
        </div>
      </Section>

      {/* Tracker card */}
      {settings.priceTrackerAcknowledged ? (
        <Section
          title="ТРЕКЕР ЦЕН"
          aside={
            <Switch
              checked={trackerOn}
              onChange={(v) => void save({ ...settings, priceTrackerEnabled: v })}
              ariaLabel="Включить трекер"
            />
          }
        >
          {entry && last ? (
            <div className="bb-trackerCard">
              <div className="bb-trackerCard__title">
                <IconTag /> {entry.title || entry.url}
              </div>
              <div className="bb-trackerCard__row">
                <span>{formatTime(last.t)}</span>
                <span className="bb-trackerCard__price">{last.byn.toFixed(2)} BYN</span>
              </div>
              {displayPoints.length > 1 ? <Sparkline points={displayPoints} /> : null}
              <div className="bb-row" style={{ justifyContent: 'flex-end' }}>
                <button
                  className="bb-btn bb-btn--soft bb-btn--sm"
                  type="button"
                  onClick={() => void resetCurrentPageHistory()}
                >
                  <IconTrash /> Очистить
                </button>
              </div>
            </div>
          ) : (
            <div className="bb-empty">
              {trackerOn
                ? 'Открой страницу товара, и история начнёт записываться.'
                : 'Трекер отключён.'}
            </div>
          )}
        </Section>
      ) : null}

      {err ? (
        <div className="bb-empty" style={{ color: 'var(--bb-danger)' }}>
          Error: {err}
        </div>
      ) : null}

      {/* Footer */}
      <footer className="bb-row" style={{ paddingTop: 4 }}>
        {status ? (
          <span className="bb-status">
            <span className="bb-statusDot" />
            {status}
          </span>
        ) : (
          <span className="bb-spacer" />
        )}
        <span className="bb-spacer" />
        <button
          className="bb-btn bb-btn--ghost bb-btn--sm"
          type="button"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          <IconSettings /> Полные настройки <IconExternal />
        </button>
      </footer>
    </div>
  )
}
