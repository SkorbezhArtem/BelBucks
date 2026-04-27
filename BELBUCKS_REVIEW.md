# BelBucks — Pre-Submission Security & Money Audit

Аудит проведён по последнему коммиту ветки `main` (`88a25dd`).
Проверено: `manifest.json`, `public/manifest.json`, content script + presets,
service worker, парсер цен, конвертер, провайдеры курсов, storage и UI
(options/popup). Тестов на содержательную логику почти нет — только
`src/shared/priceParser.test.ts` (8 кейсов), что само по себе отдельная
проблема в LOW.

В каждой находке указано `файл:строка`. Если в каком-то файле проблем нет,
он перечислен в конце с пометкой «Проблем не обнаружено».

---

## CRITICAL (Showstoppers)

### C1. В манифесте отсутствуют `icons` и `action.default_icon`
- `manifest.json:1-28`
- `public/manifest.json:1-28`

Web Store технически примет ZIP без `icons`, но листинг будет отклонён уже на
этапе автоматической проверки качества (требуются 16/48/128 PNG). В
`public/icons.svg` есть SVG-набор, но он нигде не подключён, а Chrome не
поддерживает SVG в `icons` MV3. Также нет `action.default_icon` — в тулбаре
показывается серый puzzle.

Дополнительно: в репозитории два манифеста (root + `public/`), и Vite по
умолчанию копирует `public/*` в `dist/`. Реально упаковывается
`public/manifest.json`, а корневой — мёртвый и расходится с шипимым (см. M1).

**Fix:** добавить `"icons": {"16": "...", "48": "...", "128": "..."}` и
`"default_icon"` в `action`, сгенерировать PNG из SVG, перестать таскать
дублирующий root-манифест.

---

### C2. «р.» / «р» матчится как BYN — конвертация российских рублей в доллары
- `src/shared/priceParser.ts:74` — регекс currency hint
  `(byn|br|руб|бел\.?\s*(?:руб|р)\.?|(^|\s)р\.?($|\s)|ƃ)`
- `src/content/contentScript.ts:15,22` — `PRICE_WITH_CURRENCY_RE` и
  `hasCurrencyHint` повторяют ту же логику.

Регулярка считает любой одиночный «р.» или «руб» намёком на BYN. На сайтах,
показывающих цены в **российских рублях** (Wildberries.by при определённых
A/B-выборках, AliExpress в RU-локали, перепосты с российских источников,
Onliner-каталог автозапчастей с RU-ценами и т.п.), бейдж выдаст:

`200 р.` → парсится как **200 BYN** → ≈ **$60**, тогда как реально это
**200 RUB ≈ $2**. Это финансовая дезинформация в 30× и причина
жалоб/возвратов от пользователей.

Это же поведение ломает кросс-листинговые виджеты (`isRateWidgetContext` ловит
далеко не всё — только тексты, где рядом `usd|eur|pln|rub` И слово
«курс/конвертер»; `1 000 р.` без слова «курс» проходит).

**Fix:** требовать явный BYN-маркер (`BYN`, `Br`, `бел.`, `ƃ`) **или**
явный preset для known-BYN сайта. Голый «р.» без «бел.» считать
неоднозначным и не конвертировать.

---

### C3. Все денежные расчёты на JS `number` (float64), без проверки rate <= 0
- `src/shared/converter.ts:3-18`
- `src/shared/priceParser.ts:13-58`
- `src/content/contentScript.ts:317-330`

`convertBynToTarget(byn, rate, markup) = byn / (rate * (1 + markup/100))`.
Всё это IEEE 754 doubles. Для отображения сглаживается
`Intl.NumberFormat({ maximumFractionDigits: 2 })`, поэтому drift редко
заметен — но конкретные риски:

1. `Number.isFinite(rate)` ловит NaN/Infinity, но **не** ловит `rate === 0` в
   `applyMarkup`: `applyMarkup(0, anything)` → `0`, дальше `byn / 0` →
   `Infinity`. На входе в content script стоит `if (!rate || ...)` (truthy
   check), это спасает от 0, **но**:
2. `markupPercent` валидируется только в UI слайдером `[-5, +10]`
   (`optionsApp.tsx:182-186`). В `chrome.storage.sync` пользователь (или баг
   миграции, или вредоносный скрипт через debug-консоль) может положить
   `-100` или ниже → `effectiveRate = rate * 0` или отрицательное →
   деление на ноль, либо отрицательная цена в долларах.
3. `customRates` принимает `NaN` (см. H8 ниже). Дальше `Number.isFinite`
   спасает в провайдере, но не в самом сценарии «юзер вбил 3,1.4» — UI
   молча сохраняет NaN.

**Fix:** переход на integer cents (BYN×100, USD×100) для расчётов, явная
валидация `rate > 0` и `markupPercent > -100` на границе чтения из storage,
а не только в слайдере.

---

### C4. Жёстко зашитый `scaleFor(RUB)=100` без cross-check с НБРБ
- `src/shared/rates/providers/belarusbank.ts:19-23`

```ts
function scaleFor(currency: TargetCurrency): number {
  if (currency === 'RUB') return 100
  return 1
}
```

Это держится на допущении, что фид Belarusbank всегда квотирует RUB на 100
единиц, а USD/EUR/PLN — на 1. Если банк когда-нибудь нормализует фид (или
для корпоративных клиентов отдаст другой scale), цены поедут в 100×. И —
самое опасное — никакого cross-check'а с НБРБ нет, поэтому ошибка пройдёт
тихо: пользователь увидит «$3500» вместо «$35».

То же самое в `parseRateString` (`belarusbank.ts:10-13`): если значение
прилетит как `"2 8420"` (с пробелом-thousand-separator вместо запятой)
или `"2.842,0"` (en-locale), `parseFloat` даст 2.0 или 2.842 — снова молча
неверный курс.

**Fix:** валидировать вычисленный `bynPerTarget` против последнего
известного NBRB-значения (отклонение > 25% — отбрасывать и логировать
warning); явно валидировать формат `parseRateString`.

---

### C5. Любой content script / другое расширение может форсить refresh курсов
- `src/background/serviceWorker.ts:35-44`

```ts
chrome.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
  if (typeof msg !== 'object' || msg == null) return
  const type = (msg as { type?: string }).type
  if (type === 'bb_refresh_rates') {
    void refreshRatesIfNeeded(true).then(...)
```

`_sender` помечен как unused. Нет проверки `sender.id === chrome.runtime.id`
и нет проверки, что `sender.tab` принадлежит whitelisted content_script'у.
В MV3 `externally_connectable` по умолчанию выключен, но это всё равно
DoS-ручка для NBRB/Belarusbank: на любой вкладке наш собственный код
может неограниченно дёргать `bb_refresh_rates`, и каждый раз летит **5
fetch'ей** (см. H2 + H3). Web Store reviewer'ы регулярно отказывают за
«no sender validation in runtime.onMessage handlers».

**Fix:** проверять `sender.id` и тротлить refresh.

---

### C6. При недоступном API курсы могут быть сколь угодно старыми — нет max-age
- `src/shared/rates/ratesService.ts:86-88`
- `src/background/serviceWorker.ts:6-23`

`ttlMs = 60 * 60 * 1000` (1 час). После TTL код пытается обновиться, но
если API лежит — в `refreshRatesIfNeeded` ловится исключение, а **старый
кэш сохраняется и продолжает использоваться**. Верхней границы нет.

Сценарий: НБРБ лежит 3 дня. Расширение продолжает рисовать конверсии по
курсу 3-дневной давности, без warning (`cache.warning` не выставляется,
потому что fetch ни разу не зашёл в success-ветку).

**Fix:** ввести `MAX_CACHE_AGE_MS` (24-48 ч). После него рисовать badge
с обозначением «(stale)» или вообще скрывать конверсии.

---

### C7. Любой не-BYN валютный маркер на странице конвертится в доллары как BYN
- `src/content/contentScript.ts:71-80,303` — `hasNearbyCurrencyHint` смотрит на parent/sibling textContent
- `src/shared/priceParser.ts:74` — `currencyHint` ловит только BYN-маркеры, но без bail-out на не-BYN

Сценарий с kufar (скрин пользователя):
- В одной карточке-листинге сосед-цена помечена `р.`, наша цена помечена `4.26 $`.
- `hasNearbyCurrencyHint` смотрит на `parent.textContent`, где `р.` есть → возвращает true.
- `applyToElement` идёт в ветку `parseBynPrice(rawText, { assumeByn: true })` → парсит `4.26` как BYN → `≈ $250` (×60 ошибка).

То же самое для `599 ₽`, `100 PLN`, `25 zł`, `30 €`. Сейчас в коде нет
ни одного раннего bail-out на сильные не-BYN-маркеры (`$`, `€`, `₽`, `zł`,
`USD`, `EUR`, `PLN`, `RUB`, `UAH`, `руб.рф`).

**Fix:** добавить функцию `hasStrongNonBynMarker(text)` и проверить её
**первой** в `applyToElement`. Если в тексте присутствуют не-BYN-маркеры
— сразу выходим, без `parseBynPrice`. Дополнительно: исключить наши
собственные бейджи из `hasNearbyCurrencyHint` (сейчас цикл «сосед уже
конвертирован → его текст с BYN считается hint'ом для следующего»).

---

### C8. Зачёркнутая (старая) цена обрабатывается наряду с текущей
- `src/content/contentScript.ts:347-386` — нет skip для `<s>`/`<del>`/`<strike>`
- `src/content/presets.ts:101,117` — preset newton/7745 не ловят `text-decoration: line-through`

Скрины пользователя (kufar product, newton): рядом с текущей ценой
рисуется бейдж напротив **зачёркнутой старой** цены, причём бейдж
выпадает из layout (длинная строка → текст обрезается). Корень: на этих
сайтах старая цена живёт в `.old-price`, `.was-price`, `<s>`, `<del>` или
просто в DIV с инлайн-стилем `text-decoration: line-through`. Текущий
код ничего из этого не исключает: преcет видит `[class*="price" i]` и
матчит обоих.

**Fix:**
- глобальный skip в `applyToElement` для `el.closest('s, del, strike')`;
- проверка `getComputedStyle(el).textDecorationLine.includes('line-through')`;
- расширение `excludeSelectors` на `[class*="oldPrice" i]`,
  `[class*="old-price" i]`, `[class*="was-price" i]`,
  `[class*="старая" i]`, `[class*="прежн" i]`, `[class*="strike" i]`,
  `[class*="crossed" i]`.

---

### C9. Цена рассрочки конвертируется как товарная цена (newton.by)
- `src/content/presets.ts:117` — `excludeSelectors` newton'а имеет только английские классы
- `src/content/contentScript.ts:276-345` — нет textContent-guard'а на `мес` / `в месяц` / `за месяц`

Скрин newton.by: рядом с настоящей ценой `69 BYN/корпус` показано
«Рассрочка / кредит от 2,42 руб/мес» — этот хвост попадает в наш
бейдж и портит layout. Презет newton ловит `[class*="installment" i]`,
но реальная вёрстка newton использует **русские** классы:
`.rassrochka`, `.kredit`, `.po-mesyacam`, `.cena-v-mesyac`.

**Fix:**
- добавить русские варианты в `excludeSelectors`:
  `[class*="rassroch" i]`, `[class*="kredit" i]`, `[class*="mesyac" i]`,
  `[class*="oplat" i]`, `[class*="period" i]`;
- в `applyToElement` после извлечения textVariants проверить
  `/(\bв\s*месяц|\bза\s*месяц|\/мес\b|\bмес\.|\b\/мес\.|monthly|\/mo\b|per\s*month|in\s*\d+\s*мес)/i`
  → если матч — пропускаем элемент;
- исключить контейнеры, у которых ancestor содержит `[class*="loan" i]`,
  `[class*="subscription" i]`.

---

### C10. Tracker записывает максимум по странице, а не цену конкретного товара
- `src/content/contentScript.ts:388-398` — `representative = max(pool)`
- `src/shared/priceTracker.ts:158-162` — никакого фильтра на источник

Скрин пользователя (Ginzzu corpus): реальная цена корпуса `69.00 BYN`,
но в popup'е история показывает `1961.06 BYN`. Источник — карусель
«С этим товаром покупают», селектор `.catalog_item_price .price`
матчит и центральную цену, и цены товаров-рекомендаций. После
сортировки `pool.sort()` берётся `max`, и `1961.06` (видеокарта-сосед)
записывается как «цена корпуса». При следующем заходе на ту же
страницу tracker видит «1961 → 69» (×28 спайк) и считает текущее
значение outlier'ом, оставляя в графике 1961.

**Fix:**
- `SitePreset.productPriceSelector` (singular!) — селектор, который
  должен резолвиться **в один** элемент на product-странице;
- `SitePreset.isProductPage(loc)` — boolean: только на product-page
  пишем в tracker;
- основной источник истины — `Product.offers.price` из JSON-LD;
  fallback — `productPriceSelector` если в DOM ровно одно соответствие;
- если источник не дал однозначной цены — `recordPricePoint` НЕ зовётся.

---

### C11. URL-ключ tracker'а различает страницы по любому query-параметру
- `src/shared/priceTracker.ts:158-162` — `cleanUrl = url.split('#')[0]`

`?utm_source=...`, `?session_id=...`, `?from=catalog`, A/B-ключи
маркетплейсов и любой track-pixel меняют URL → у одного товара в
storage появляются 5–10 entry'ев с разными «последними» ценами,
которые не агрегируются. Popup ищет fallback по
`origin+pathname` (`popupApp.tsx:97-106`), но это чинит только
визуализацию, не исправляет данных в storage и не помогает trend'у.

**Fix:**
- canonicalize URL: `new URL(href); url.hash=''`;
- удалять все query-params, кроме whitelisted (`id`, `pid`, `sku`,
  `product_id`);
- per-host overrides: на kufar нужно сохранить `id`, на onliner —
  `id`/`product`, на 21vek — `model`/`sku`.

---

## HIGH (Перформанс / отказ Web Store / финансовые мисалайнменты)

### H1. `<all_urls>` content_script + `activeTab` без privacy policy
- `manifest.json:15-26`

`"matches": ["<all_urls>"]` — broad host permission. В сочетании с
`activeTab` это red flag. Расширение **сохраняет посещённые URL и
их title** в `chrome.storage.local` (см. priceTracker). Это «Web
History» по определению Web Store. Без явной privacy-policy и Single
Purpose statement это автоматический отказ по разделу «User Data».

**Fix:** убрать `activeTab`, опубликовать privacy policy, сделать
tracker opt-in (см. C10/H15).

---

### H2. Belarusbank fetch'ится 4 раза за один refresh, NBRB — последовательно
- `src/shared/rates/ratesService.ts:47-69`

При `provider === 'BankAverage'` каждый итератор вызывает
`fetchBelarusbankAvgBynPerTarget`, который сам делает
`fetchBelarusbankCityRates` с одним и тем же URL. **4 одинаковых HTTP
запроса** на один refresh. NBRB — то же самое: 4 sequential `await`.

**Fix:** мемоизировать ответ Belarusbank внутри одной попытки refresh;
NBRB — `Promise.all`.

---

### H3. MutationObserver на `documentElement` + `subtree:true` без budget
- `src/content/contentScript.ts:424-425`

На SPA-маркетплейсах каждое раскрытие аккордеона = MutationRecord.
Дебаунс 250 мс есть, но при непрерывных анимациях (sticky header) —
1 scan / 250 мс пожизненно. `mutationScopeSelector` уже есть в
`SitePreset`, но `init()` его не использует.

---

### H4. Layout thrashing: `getComputedStyle` на каждом кандидате
- `src/content/contentScript.ts:82-89`

`offsetParent` и `getComputedStyle` оба форсят synchronous layout.
На странице с 100 кандидатами это 100+ layout pass'ов за один scan.

---

### H5. На любое изменение настроек — `resetRenderedBadges()` + полный rescan
- `src/content/contentScript.ts:434-477`

Каждый клик по color picker'у в options = rescan на всех вкладках.

---

### H6. `init()` + listener регистрируется только при `enabled === true`
- `src/content/contentScript.ts:410-413, 477`

Toggle «Этот сайт» в popup'е требует Ctrl+F5 если страница изначально
была disabled.

---

### H7. Нет dedupe конкурентных `bb_refresh_rates`
- `src/background/serviceWorker.ts:6-44`

5 вкладок маркетплейсов + popup-кнопка «Обновить» → 6 параллельных
серий по 4-8 fetch'ей.

---

### H8. UI принимает NaN в custom rates и сохраняет в storage
- `src/ui/options/optionsApp.tsx:283-289`

«3.1.4», «abc» → NaN → JSON.stringify → null → «Custom rate missing».

---

### H9. `convertBynToTarget` не округляет к валютной точности
- `src/shared/converter.ts:11-28`

`maximumFractionDigits: 2` без `minimumFractionDigits` даёт `$0.5`
вместо `$0.50`. Для RUB банковский стандарт — 0 десятичных, но Intl
с `currency: 'RUB'` рисует `RUB 31.45`.

---

### H10. `extractSplitPriceVariant` тащит цифры из любых вложенных тегов
- `src/content/contentScript.ts:129-162`

`<sup>2</sup>` (сноска на гарантию) внутри ценового блока с цифрой
`40` даст `40.20` вместо `40.00`.

---

### H11. Belarusbank rate без sanity range check
- `src/shared/rates/providers/belarusbank.ts:34-77`

`USD_out: "0.00"` от закрытого отделения попадёт в среднее. В
`fetchBelarusbankBestBynPerTarget` ситуация ярче: best = `min`
→ `0.01` → конверсия в миллион раз в пользу пользователя.

---

### H12. Нет машинно-читаемого детектора валюты страницы (JSON-LD / Microdata / og)
- `src/content/contentScript.ts:347-399` — `scan` не смотрит ни на JSON-LD, ни на `meta[itemprop="priceCurrency"]`, ни на `og:price:currency`

90% e-comm-сайтов (Ozon, WB, 21vek, Onliner, Newton, Lamoda, Aliexpress)
объявляют валюту в JSON-LD `Product.offers.priceCurrency`. Ни один из
этих сигналов сейчас не используется. Если страница декларирует
`priceCurrency: "RUB"` — расширение должно молча идлить и не
конвертировать вообще ничего.

**Fix:** в начале `scan(document)` — `detectMachineCurrency(document)`
с приоритетом JSON-LD > Microdata > Open Graph > `data-currency`.
Если результат не `BYN` и не `null` — short-circuit без single
вызова `applyToElement`.

---

### H13. Sanity-cap `>= 1 && <= 1_000_000` BYN режет недвижимость и подарочные мелочи
- `src/content/contentScript.ts:309`

```ts
if (candidate && candidate.byn >= 1 && candidate.byn <= 1_000_000) {
  parsedCandidates.push(candidate.byn)
}
```

Real estate на kufar/realt/onliner: квартиры 800 000 – 2 500 000 BYN
проходят, но дома по 1 200 000 – 1 800 000 BYN — частично выпадают;
коттеджи/коммерческая недвижимость 1.5–4M — полностью режутся.
С другой стороны, реальные товары по `0,50 р.` (упаковочные мелочи,
открытки, фурнитура) не получают бейдж из-за нижнего порога.

**Fix:**
- `priceRange: { min: number; max: number }` per-preset (real-estate,
  cars — широкий диапазон; маркетплейсы — узкий);
- relative cap: считаем медиану всех уже распарсенных значений на
  странице; отбрасываем то, что отклоняется > 100× (отсекает
  расчётные счета, артикулы);
- глобальный нижний порог `0.01` (вместо 1).

---

### H14. Tracker не имеет write-time anti-spike фильтра
- `src/shared/priceTracker.ts:103-156`

`sanitizePoints` чистит спайки только при чтении и только если
delta > 8× от соседей. Если на странице был misparse и записалось
1961 при настоящих 69, при следующем заходе 69 будет считаться
outlier'ом относительно 1961, и в графике останется 1961. То есть
ошибочное значение «застревает» в истории.

**Fix:**
- write-time: если |new - last| / last > 5 → отказываем в записи;
- если последняя точка выглядит outlier'ом (|last - prev| > 5×
  median(prev 5 points)) — стираем её при первой записи новой точки;
- `MIN_RECORD_INTERVAL_MS` поднять до 6 часов (хватит, чтобы не
  забивать историю при многократном заходе на одну страницу).

---

### H15. Tracker включён by default, фактически собирает историю просмотров
- `src/shared/priceTracker.ts` (вся логика)
- `src/content/contentScript.ts:396` — `recordPricePoint(location.href, document.title, …)`

Каждый scan вызывает `recordPricePoint(url, title, value)`, причём
**на любом** сайте под `<all_urls>`. Storage накапливает URL +
title + timestamp без согласия пользователя. Web Store этому даст
red flag «Web History» (см. H1).

**Fix:**
- `userSettings.priceTrackerEnabled: boolean` (default `false`);
- баннер в options/popup при первой активации с явным disclosure:
  «BelBucks сохраняет URL и название товара локально, чтобы рисовать
  график цен. Данные не уходят на сервер. Список можно очистить.»;
- если флаг выключен — `recordPricePoint` no-op.

---

## MEDIUM

### M1. Два манифеста, рассинхронизация неминуема
- `manifest.json` (root) vs `public/manifest.json`

PR-ревью изменит один — соберётся другой.

---

### M2. `scripts/build-extension.mjs` не валидирует наличие иконок и кладёт sourcemap в продакшн
- `scripts/build-extension.mjs:13-32`

`.map`-файлы попадают в финальный ZIP — это +30-50% размера.

---

### M3. CSP в манифесте не задана явно
- `manifest.json:1-28`

MV3 default CSP подходит, но явное `content_security_policy.extension_pages`
снижает риск регрессий.

---

### M4. Сервис воркер не валидирует структуру JSON ответа
- `src/shared/rates/providers/nbrb.ts:14`

`as` — это TS-каст, а не runtime-валидация.

---

### M5. `recordPricePoint` пишет в `chrome.storage.local` без try/catch на одном из путей
- `src/shared/priceTracker.ts:89-93`

Quota-exceeded бросит из `set()`. UI ловит общий catch, но ошибка скрыта.

---

### M6. `Object.values(store)` обходится в popup на каждом открытии
- `src/ui/popup/popupApp.tsx:99-106`

При 200 entries × N полей это десятки итераций + `new URL(e.url)`.

---

### M7. `clearPriceHistoryForUrl` удаляет по origin+pathname, не учитывая разные товары на одной полосе
- `src/shared/priceTracker.ts:175-189`

Удалит легитимные дубликаты по варианту товара.

---

### M8. `presets.ts` для wildberries.by/ozon.by/realt.by использует `[class*="price" i]` без excludeSelectors
- `src/content/presets.ts:120-148`

На WB/Ozon-листинге в одной карточке: текущая цена, старая цена,
цена с картой, цена в кредит. Все они матчат `[class*="price" i]`.

---

### M9. Settings сохраняются в `chrome.storage.sync` (8 KB / item, 100 KB total)
- `src/shared/storage.ts:67-114`

При 50+ доменах с visual override'ами сериализация перевалит за 8 KB.

---

### M10. `Number.parseFloat(s.replace(',', '.'))` в Belarusbank-парсере хрупкий
- `src/shared/rates/providers/belarusbank.ts:10-13`

Не обрабатывает: NBSP, тонкие пробелы, ведущий `+`, точку как
thousand-separator.

---

### M11. Кэш курсов в `chrome.storage.local` не имеет version-marker
- `src/shared/rates/ratesService.ts:71-79`

Если структура `RatesCache` поменяется без bump'а ключа, бейджи
исчезнут до первого refresh.

---

### M12. `init()` гонится с `bb_refresh_rates` от множества вкладок
- `src/content/contentScript.ts:417-420`

10 одновременно открытых вкладок = 40 fetch'ей в одну миллисекунду.

---

### M13. `formatTargetCurrency` всегда `en-US`, а сайты — на белорусском/русском
- `src/shared/converter.ts:20-28`

`«EUR 100.00»` без `€`. На белорусских сайтах выглядит «не родным».

---

### M14. Параллельная история по одному и тому же товару из-за query-params
- `src/shared/priceTracker.ts:158-162`

См. C11. В medium-разделе остаётся как «нужна canonicalization».

---

## LOW

### L1. `extractSiblingMinorVariant` — onliner-specific селектор в общем коде
- `src/content/contentScript.ts:172-174`

`.h_flx_nsh.h_txt_hdl, .h_txt_hdl` — onliner-классы захардкожены в
shared content script вместо presets.

---

### L2. `MAX_ENTRIES = 200`, `MAX_POINTS_PER_ENTRY = 30` — без UI для очистки всего
- `src/shared/priceTracker.ts:16-17`

Юзер не имеет батч-команды «wipe history».

---

### L3. `chrome.runtime.openOptionsPage()` без error handling
- `src/ui/popup/popupApp.tsx:285`

В управляемом Chrome (enterprise policy) этот вызов может бросить —
тихо ничего не происходит.

---

### L4. `React.StrictMode` в production-bundle — двойной mount эффектов
- `src/ui/popup/main.tsx:7`, `src/ui/options/main.tsx:7`

Двойной `getSettings()` + `chrome.tabs.query` на каждое открытие popup.

---

### L5. Тесты покрывают только `priceParser`
- `src/shared/priceParser.test.ts` — единственный тест-файл.

Нет тестов на `converter`, `siteRules`, `priceTracker`, `ratesService`.

---

### L6. ~~`tsconfig.json` использует `typescript: ~6.0.2`~~  Снято
- `package.json:25`

Подтверждено: TS 6.0.3 действительно вышел в стабильной мажорной
ветке. `~6.0.2` корректно.

---

### L7. README `Permissions` секция расходится с кодом
- `README.md:73-75`

`activeTab` обещает «context actions», которых в коде нет.

---

### L8. `description` в манифесте без локализации
- `manifest.json:4`

Если планируется RU-локаль листинга — нужно `default_locale` и `_locales/`.

---

### L9. `siteVisualRules` UI показывает все правила без сортировки по specificity
- `src/ui/options/optionsApp.tsx:89`

Юзер видит «как добавилось», без понимания, какое из них реально применится.

---

### L10. `cache: 'no-store'` в каждом fetch
- `src/shared/rates/providers/nbrb.ts:12`

Запрещает HTTP-кэширование. Для refresh раз в час это ок, но
блокирует возможность получить response из browser cache при flaky сети.

---

## Файлы без критических замечаний

- `src/shared/siteRules.ts` — Проблем не обнаружено.
- `src/shared/siteVisual.ts` — Проблем не обнаружено.
- `src/ui/options/main.tsx`, `src/ui/popup/main.tsx` — Проблем не
  обнаружено (модулу пара строк).
- `popup.html`, `options.html` — Проблем не обнаружено (нет inline-script,
  нет внешних URL).

---

## Предположения, которые делает код, но не проверяет

1. **«р.» / «р» / «руб» — это всегда белорусский рубль.** На любом
   русском контенте это RUB. См. C2.
2. **`Cur_Scale` от НБРБ всегда нормированный и > 0**, но код прячет
   нулевой scale за `|| 1`.
3. **`USD_out` Belarusbank — это «1 USD = X BYN» (банк продаёт USD)**;
   семантика нигде не комментируется.
4. **RUB у Belarusbank всегда квотируется на 100 единиц.** Hardcoded.
5. **Цены ниже 1 BYN — это шум.** Контентскрипт фильтрует
   `parsedByn >= 1` (`contentScript.ts:309`). См. H13.
6. **Цены выше 1 000 000 BYN — это шум.** См. H13.
7. **`<sup>` / `<i>` внутри price-элемента — это всегда minor-часть
   цены**, никогда не сноска и не суффикс акции. См. H10.
8. **DOM элементы с `display:none` / `visibility:hidden` /
   `opacity:0` никогда не содержат отображаемых цен.**
9. **MutationObserver не получит mutation от собственной вставки
   бейджа в бесконечный цикл.**
10. **Quota `chrome.storage.sync` (8 KB / item) никогда не будет
    превышено пользователем.** См. M9.
11. **Кэш курсов старше 60 минут можно не использовать; верхней
    границы нет.** См. C6.
12. **Service worker не упадёт между `await fetch` и `setRatesCache`.**
13. **На install у пользователя есть интернет.**
14. **Hostname matching через `(^|\.)kufar\.by$`** покрывает все
    кейсы. IDN-домены, Punycode, alt-TLD .com — нет. См. R5
    (host-allowlist через JSON-LD).
15. **`markupPercent ∈ [-5, +10]`.** Валидация только в slider'е.
16. **`customRates[c]` валиден.** UI пишет NaN. См. H8.
17. **Сообщения `chrome.runtime.onMessage` приходят только от своего
    popup/options.** См. C5.
18. **У пользователя `chrome.storage.sync` включён.**
19. **Курс из любого источника корректен и осмысленный.** Нет sanity
    range check.
20. **Парсинг `parseLocalizedNumber` всегда выберет правильный
    decimal separator.** Граница `^\d{3}$` хрупкая.
21. **MV3-сервисворкер успеет обработать `onMessage` за 30 секунд** —
    стандартный лимит idle SW.
22. **Цена, помеченная `р.` рядом с символом `$`, — всё равно BYN.**
    `hasNearbyCurrencyHint` смотрит на parent.textContent, где
    может быть и BYN-сосед, и `$`-маркер; не-BYN-маркеры
    игнорируются полностью. См. C7.
23. **`<s>` / `<del>` / `<strike>` / `text-decoration: line-through`
    никогда не используются для цены.** На kufar/onliner/newton —
    используются. См. C8.
24. **Слово «мес.» рядом с числом — это всегда не цена.**  Сейчас
    нет такой проверки; рассрочка попадает в бейдж. См. C9.
25. **На product-странице селекторы `[class*="price" i]` дают ровно
    одно совпадение.** Реально матчят и карусель «вместе с этим
    покупают», и виджеты «рекомендации». См. C10.
26. **URL без хэша достаточно для идентификации товара.** Игнорируются
    `?utm_source=`, `?session_id=`, A/B-ключи. См. C11.
27. **Сторонние JSON-LD / Microdata / og:price:currency не нужно
    читать.** Игнорируется машинно-читаемая валюта страницы — тогда
    как 90% e-comm SEO-обязаны её декларировать. См. H12.

---

## Резюме

| Severity | Count |
|----------|-------|
| CRITICAL | 11 (было 6 + новые: C7–C11) |
| HIGH     | 15 (было 11 + новые: H12–H15) |
| MEDIUM   | 14 |
| LOW      | 10 |

**Не публиковать в Web Store до фикса** как минимум C1, C2, C5, C6, C7,
C8, C9, C10, C11, H1, H12, H15.

Без C7/C8/C9 — кейсы с реальных скринов kufar/newton дают финансовую
дезинформацию: $-цена показывается умноженной на курс, зачёркнутая старая
цена ломает layout, цена рассрочки конвертируется как товарная цена.
Без C10/C11 — история цен показывает чужие товары; trend бесполезен.
Без H12 — расширение работает на сайтах, явно объявивших RUB/USD/EUR.
Без H15 — Web Store откажет за «Web History» без disclosure.

---

# Roadmap по итогам аудита

Аудит сам по себе — список багов. Здесь — план, как их закрыть, и куда
двигаться дальше до релиза 1.0.

## Sprint 1 — Финансовая корректность (P0, блокер Web Store)

Цель: ни одного **финансово некорректного** бейджа на скринах
пользователя.

- (R1) Машинно-читаемый детектор валюты страницы: JSON-LD `Product.offers.priceCurrency`,
  Microdata `[itemprop="priceCurrency"]`, Open Graph `product:price:currency`,
  `data-currency` / `data-price-currency`. Если страница объявляет
  не-BYN валюту — расширение idle'ит. Закрывает H12, частично C7.
- (R2) Сильные не-BYN-маркеры в `applyToElement`: `$`, `€`, `₽`,
  `zł`, `kr`, `£`, `¥`, `USD`, `EUR`, `PLN`, `RUB`, `UAH`, `руб.рф`,
  `RUR`. Перед `parseBynPrice` — short-circuit. Закрывает C2, C7.
- (R3) Skip зачёркнутых: `el.closest('s, del, strike')`, computed-style
  `text-decoration: line-through`, расширенные `excludeSelectors`
  для `oldPrice`/`старая цена`/`was-price`/`crossed`. Закрывает C8.
- (R4) Skip рассрочки/кредита: русские классы (`rassroch`, `kredit`,
  `mesyac`), textContent-guard `/\bв\s*месяц|\/мес\b|monthly|per\s*month/i`.
  Закрывает C9.
- (R5) Sanity-cap rework: `priceRange` per-preset; глобальный fallback —
  median-relative (×100). Закрывает H13. Real estate / cars получают
  широкий диапазон.
- (R6) Skip self-rendered badges в `hasNearbyCurrencyHint` (наш бейдж
  не должен считаться currency hint'ом для соседнего элемента).
- (R7) Markup и rate clamping в `convertBynToTarget` (защита от
  storage-poisoning). Частично закрывает C3.

## Sprint 2 — Корректность tracker'а

Цель: график в popup'е показывает цену **этого** товара, а не максимум
по странице.

- (R8) `SitePreset.productPriceSelector` (singular) и
  `SitePreset.isProductPage(loc)`. На листинговых страницах — tracker
  выключен. Закрывает C10.
- (R9) Источник истины — JSON-LD `Product.offers.price`. Парсится в
  contentScript'е перед DOM-fallback'ом. Если есть JSON-LD цена —
  пишем её, без `applyToElement`-агрегации.
- (R10) Tracker opt-in (`UserSettings.priceTrackerEnabled`, default
  `false`). Banner в options/popup при активации. Закрывает H15.
- (R11) Write-time anti-spike: |new - last| / last > 5 → reject,
  плюс `MIN_RECORD_INTERVAL_MS = 6h`. Закрывает H14.
- (R12) URL canonicalization: query whitelist по host'у; default —
  все query удалены. Закрывает C11.

## Sprint 3 — Web Store compliance

Цель: пройти модерацию.

- (R13) Иконки 16/48/128 PNG в манифесте + `action.default_icon`. C1.
- (R14) Удалить дубликат root-`manifest.json`. M1.
- (R15) Убрать `activeTab` (используется только для
  `tabs.query({active:true})`, что и так работает с `tabs`-permission).
  Частично H1.
- (R16) Sender-validation в `serviceWorker.onMessage`:
  `sender.id === chrome.runtime.id`; throttling refresh. C5.
- (R17) `MAX_CACHE_AGE_MS` (24-48 ч) с явным warning'ом. C6.
- (R18) Privacy policy + Single Purpose statement (документ + ссылка
  в options).
- (R19) `sourcemap: false` в production-сборке. M2.

## Sprint 4 — Гибкость и пресеты

Цель: расширение работает на ~30 главных BY-маркетплейсах из
коробки + пользователь может настроить под себя любой сайт.

- (R20) Расширить `SitePreset` schema:
  - `defaultCurrency: 'BYN' | 'AUTO'`,
  - `priceRange: { min, max }`,
  - `crossedPriceSelectors: string[]`,
  - `installmentSelectors: string[]`,
  - `productPriceSelector: string` (singular),
  - `isProductPage: (loc) => boolean`,
  - `forceAssumeByn: boolean` (вместо хардкода в contentScript:350).
- (R21) Добавить пресеты для ~20 BY-хостов:
  oz, deal, 5element, lamoda, mile, mts-shop, megatop, technopoint,
  holodilnik, electrosila, tehnomir, elcom, abw, dom, kvartirant,
  realt-onliner, mototehnika, apteka, edostavka, gippo, sosedi,
  evroopt, dochkisinochki.
- (R22) Popup per-host панель: allow/block/force-byn/customize для
  активной вкладки.
- (R23) `siteVisual` strategies в presets/options:
  `inline | block-below | tooltip-on-hover | replace | prepend`.
- (R24) Шаблон бейджа: `≈ {primary}`, `≈ {primary} · {secondary}`,
  `{primary} ({byn} BYN)`, custom user template.

## Sprint 5 — Element picker и user-defined rules

Цель: «навороты» из обсуждения. Пользователь сам тыкает в цену
на сайте, который мы не знаем.

- (R25) `userPriceRules: Record<host, UserRule>` в `chrome.storage.sync`.
- (R26) Resolve order: `userRule (highest) > preset > generic (lowest)`,
  где userRule **дополняет** селекторы, а не заменяет (приходит
  в конец списка).
- (R27) UI overlay с crosshair: на hover — синяя рамка + tooltip
  (selector + parsed BYN). На click — контекстное меню «Это цена /
  старая цена / рассрочка / не цена / отмена».
- (R28) Селектор-генератор: `[itemprop]`/`data-*` приоритет, fallback
  — кратчайший unique CSS selector через `el.tagName + nth-of-type`.
- (R29) После save — re-scan + новые бейджи появляются live, без
  reload.
- (R30) Per-host disable toggle (отдельно от глобального).

## Sprint 6 — Тесты и стабильность (релиз 1.0)

- (R31) Юнит-тесты на `parseLocalizedNumber` и `parseBynPrice`,
  включая кейсы из реальных багов: «86 25» (split fractional →
  должно вернуть 86.25, а не 8625), «4.26 $» (должно вернуть null),
  «150 р.» в окружении `<meta itemprop="priceCurrency" content="RUB">`
  (должно вернуть null), «1.500» (1500 BYN, не 1.5).
- (R32) Юнит-тесты на `priceTracker`: anti-spike, URL canonicalization,
  single-product-match.
- (R33) Снапшот-тест на `getPresetForLocation` (allow/block/force).
- (R34) Manual QA-чеклист по 30 хостам.

## После 1.0 — Optional

- Community-presets через Pull-Request (JSON-файлы в репо;
  расширение подтягивает обновлённый список).
- Drag-to-reposition бейджа на странице.
- Dry-run mode (overlay цветом — что бы конвертировалось, без
  реального бейджа).
- A/B comparison двух провайдеров курсов одновременно.
