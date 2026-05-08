import { getRatesCache, getSettings, setRatesCache } from '../shared/storage'
import { fetchRatesForSettings, isRatesCacheFresh } from '../shared/rates/ratesService'

const ALARM_NAME = 'belbucks_refresh_rates'

async function refreshRatesIfNeeded(force: boolean): Promise<{ ok: boolean; warning?: string; error?: string }> {
  const settings = await getSettings()
  if (!settings.enabled) return { ok: true }

  const existing = await getRatesCache()
  if (!force && existing && isRatesCacheFresh(existing)) return { ok: true, warning: existing.warning }

  try {
    const cache = await fetchRatesForSettings(settings)
    await setRatesCache(cache)
    return { ok: true, warning: cache.warning }
  } catch (e) {
    // Network/API may temporarily fail (e.g. NBRB outage). Keep the last known cache.
    // Avoid unhandled promise rejections in the MV3 service worker.
    console.warn('BelBucks: rates refresh failed', e)
    return { ok: false, error: String(e) }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 60 })
  void refreshRatesIfNeeded(true).catch(() => {})
})

chrome.alarms.onAlarm.addListener((alarm: chrome.alarms.Alarm) => {
  if (alarm.name !== ALARM_NAME) return
  void refreshRatesIfNeeded(false).catch(() => {})
})

function isTrustedSender(sender: chrome.runtime.MessageSender): boolean {
  // Same extension only. External pages (including same-origin iframes that
  // somehow forward messages) get sender.id !== chrome.runtime.id.
  if (sender.id && sender.id !== chrome.runtime.id) return false
  // Reject messages whose origin we cannot verify (e.g. coming from a
  // sandboxed iframe with no url/origin set).
  if (sender.tab && !sender.url && !sender.origin) return false
  return true
}

chrome.runtime.onMessage.addListener((msg: unknown, sender, sendResponse) => {
  if (!isTrustedSender(sender)) return
  if (typeof msg !== 'object' || msg == null) return
  const type = (msg as { type?: string }).type
  if (type === 'bb_refresh_rates') {
    void refreshRatesIfNeeded(true)
      .then((result) => sendResponse(result))
      .catch((e: unknown) => sendResponse({ ok: false, error: String(e) }))
    return true
  }
})

