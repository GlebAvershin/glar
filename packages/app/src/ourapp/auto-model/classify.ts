/**
 * OurApp — авто-выбор модели («auto»).
 *
 * Эвристический классификатор: по тексту запроса, наличию документов и длине
 * определяет «тир» сложности и возвращает подходящий код модели (алиас LiteLLM).
 *
 * БЕЗ обращения к LLM — мгновенно и бесплатно, кредиты на сам выбор не тратятся.
 * Решение фиксированное и объяснимое (см. `reason`), что важно для доверия
 * юристов/бухгалтеров.
 *
 * Пул моделей (решение пользователя): GigaChat / YandexGPT / Claude.
 * Карта тир→модель вынесена в TIER_MODEL — её можно править одной строкой,
 * напр. подставить gigachat-max/yandexgpt вместо gigachat-pro в РФ-тир.
 *
 * Тиры по возрастанию сложности:
 *   lite — короткий справочный вопрос            → GigaChat Lite (РФ, дёшево)
 *   pro  — объяснение / средний РФ-запрос         → GigaChat Pro  (РФ, данные в РФ)
 *   mid  — анализ, работа с документом            → Claude Sonnet (+авто-маскирование)
 *   top  — сложная подготовка документа           → Claude Opus
 */

export type AutoTier = "lite" | "pro" | "mid" | "top"

export interface AutoClassification {
  tier: AutoTier
  /** Код модели (алиас LiteLLM), напр. "claude-sonnet". */
  modelCode: string
  /** Короткое объяснение выбора для UI/тултипа. */
  reason: string
}

export interface ClassifyInput {
  /** Текст запроса (то, что реально уйдёт в модель). */
  text: string
  /** Есть ли прикреплённые документы/сканы. */
  hasDocument: boolean
}

/**
 * Карта тир → код модели. lite/pro — РФ (данные не покидают РФ), mid/top — Claude
 * (сильнее на юридических задачах; ПДн авто-маскируются перед отправкой).
 * Меняйте значения, чтобы переназначить модель тира — напр. pro: "gigachat-max"
 * или "yandexgpt".
 */
export const TIER_MODEL: Record<AutoTier, string> = {
  lite: "gigachat-lite",
  pro: "gigachat-pro",
  mid: "claude-sonnet",
  top: "claude-opus",
}

// Генеративные/сложные задачи — нужна сильная модель (top).
const TOP_PATTERNS = [
  /состав(ь|ить|им|ьте)/i,
  /подготов(ь|ить|им|ьте)/i,
  /напиш(и|ите|ем)/i,
  /сформулир/i,
  /исков|иск\b|искового/i,
  /претензи/i,
  /жалоб/i,
  /ходатайств/i,
  /апелляц/i,
  /кассац/i,
  /пояснительн/i,
  /мотивирован/i,
  /проект\s+(документа|договора|иска|письма)/i,
  /стратеги|позици(я|ю)\s+по\s+делу/i,
]

// Аналитические задачи / работа с документом — Claude Sonnet (mid).
const MID_PATTERNS = [
  /провер(ь|ить|ка|ке|ку|ьте)/i,
  /риск/i,
  /проанализир|анализ/i,
  /сравн(и|ить|ение|ите)/i,
  /сверк/i,
  /заключени/i,
  /оцен(и|ить|ка|ите)/i,
  /экспертиз/i,
  /толкован/i,
  /соответств/i,
  /перви(чк|чн)/i,
  /требовани[ея]\s+(фнс|налоговой)/i,
]

// Объяснение / обучающий вопрос — РФ-модель GigaChat Pro (pro).
const EXPLAIN_PATTERNS = [
  /объясн/i,
  /поясни\b/i,
  /разъясн/i,
  /на\s+пальцах/i,
  /своими\s+словами/i,
  /в\s+чём\s+(разниц|смысл|суть)/i,
  /приведи\s+пример/i,
  /как\s+.{0,30}(рассчита|посчита|оформи|заполни|применя)/i,
]

const SHORT_MAX = 400 // символов — выше этого короткий вопрос тянет на pro
const LONG_TEXT = 1500 // длинный запрос тянет минимум на mid
const VERY_LONG_TEXT = 4000 // очень длинный — тянет на top

const anyMatch = (text: string, patterns: RegExp[]) => patterns.some((re) => re.test(text))

/**
 * Классифицировать запрос и выбрать модель. Чистая функция — легко тестировать.
 */
export function classifyRequest(input: ClassifyInput): AutoClassification {
  const text = input.text ?? ""
  const len = text.length

  const top = anyMatch(text, TOP_PATTERNS)
  const mid = anyMatch(text, MID_PATTERNS)
  const explain = anyMatch(text, EXPLAIN_PATTERNS)

  // 1. Явные генеративные задачи или очень большой объём → top.
  if (top) {
    return { tier: "top", modelCode: TIER_MODEL.top, reason: "сложная подготовка документа" }
  }
  if (len >= VERY_LONG_TEXT) {
    return { tier: "top", modelCode: TIER_MODEL.top, reason: "большой объём текста" }
  }

  // 2. Аналитика, работа с документом, средняя длина → mid (Claude Sonnet).
  if (mid || input.hasDocument || len >= LONG_TEXT) {
    const reason = mid
      ? "анализ / проверка"
      : input.hasDocument
        ? "работа с документом"
        : "развёрнутый запрос"
    return { tier: "mid", modelCode: TIER_MODEL.mid, reason }
  }

  // 3. Объяснение или средний по длине запрос → pro (GigaChat Pro, РФ).
  if (explain || len >= SHORT_MAX) {
    return { tier: "pro", modelCode: TIER_MODEL.pro, reason: explain ? "объяснение" : "средний запрос" }
  }

  // 4. Короткий справочный вопрос → lite (РФ, дёшево).
  return { tier: "lite", modelCode: TIER_MODEL.lite, reason: "короткий вопрос" }
}
