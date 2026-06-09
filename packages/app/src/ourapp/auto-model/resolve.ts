/**
 * OurApp — резолвинг авто-выбранной модели в реальную пару {providerID, modelID}.
 *
 * Классификатор возвращает тир + код-алиас (напр. "claude-sonnet"). Здесь:
 *  1) пробуем точный код (наш шлюз отдаёт ровно эти алиасы);
 *  2) если его нет — ищем по СЕМЕЙСТВУ в рамках пула (claude/gigachat/yandex),
 *     терпя версионные суффиксы (claude-opus-4-8, gigachat-pro и т.п.);
 *  3) если для тира ничего нет — берём ближайший доступный тир.
 *
 * Пул жёстко ограничен семействами claude/gigachat/yandex (решение пользователя),
 * поэтому авто НИКОГДА не выберет GPT/DeepSeek/прочие подключённые модели.
 */
import { classifyRequest, TIER_MODEL, type AutoClassification, type AutoTier, type ClassifyInput } from "./classify"

export interface ModelListItem {
  id: string
  provider: { id: string }
}

export interface AutoPick {
  providerID: string
  modelID: string
  classification: AutoClassification
}

const TIERS: AutoTier[] = ["lite", "pro", "mid", "top"]

/** Разрешённые семейства (пул) — авто выбирает только из них. */
const POOL_RE = /claude|gigachat|yandex/i

/**
 * Ключевые слова для подбора модели тира по id, когда точного алиаса нет.
 * Порядок = приоритет. Все — внутри пула claude/gigachat/yandex.
 */
const TIER_KEYWORDS: Record<AutoTier, string[]> = {
  lite: ["gigachat-lite", "gigachat", "yandexgpt-lite", "yandex", "haiku"],
  pro: ["gigachat-pro", "gigachat-max", "gigachat", "yandexgpt", "yandex"],
  mid: ["claude-sonnet", "sonnet"],
  top: ["claude-opus", "opus"],
}

const inPool = (m: ModelListItem) => POOL_RE.test(m.id)

/** Найти модель для конкретного тира: точный код → ключевые слова в пуле. */
function findForTier(list: ModelListItem[], tier: AutoTier): ModelListItem | undefined {
  const exact = list.find((m) => m.id === TIER_MODEL[tier])
  if (exact) return exact
  for (const kw of TIER_KEYWORDS[tier]) {
    const found = list.find((m) => inPool(m) && m.id.toLowerCase().includes(kw))
    if (found) return found
  }
  return undefined
}

/** Порядок перебора тиров: сначала выбранный, затем ближайшие (ничья → старший). */
function tierSearchOrder(tier: AutoTier): AutoTier[] {
  const i = TIERS.indexOf(tier)
  return [...TIERS].sort((a, b) => {
    const da = Math.abs(TIERS.indexOf(a) - i)
    const db = Math.abs(TIERS.indexOf(b) - i)
    if (da !== db) return da - db
    return TIERS.indexOf(b) - TIERS.indexOf(a)
  })
}

/**
 * Выбрать модель для режима «Авто». Возвращает undefined, только если ни одной
 * модели из пула (claude/gigachat/yandex) нет в списке — тогда остаётся ручная.
 */
export function pickAutoModel(input: ClassifyInput, list: ModelListItem[]): AutoPick | undefined {
  const classification = classifyRequest(input)

  for (const tier of tierSearchOrder(classification.tier)) {
    const found = findForTier(list, tier)
    if (found) {
      return {
        providerID: found.provider.id,
        modelID: found.id,
        classification: { ...classification, tier, modelCode: found.id },
      }
    }
  }

  return undefined
}
