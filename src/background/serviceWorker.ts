import { getRatesCache, getSettings, setRatesCache } from '../shared/storage'
import { fetchRatesForSettings, isRatesCacheFresh } from '../shared/rates/ratesService'

const ALARM_NAME = 'belbucks_refresh_rates'

async function refreshRatesIfNeeded(force: boolean): Promise<void> {
  const settings = await getSettings()
  if (!settings.enabled) return

  const existing = await getRatesCache()
  if (!force && existing && isRatesCacheFresh(existing)) return

  const cache = await fetchRatesForSettings(settings)
  await setRatesCache(cache)
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 60 })
  void refreshRatesIfNeeded(true)
})

chrome.alarms.onAlarm.addListener((alarm: chrome.alarms.Alarm) => {
  if (alarm.name !== ALARM_NAME) return
  void refreshRatesIfNeeded(false)
})

chrome.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
  if (typeof msg !== 'object' || msg == null) return
  const type = (msg as { type?: string }).type
  if (type === 'bb_refresh_rates') {
    void refreshRatesIfNeeded(true)
      .then(() => sendResponse({ ok: true }))
      .catch((e: unknown) => sendResponse({ ok: false, error: String(e) }))
    return true
  }
})

