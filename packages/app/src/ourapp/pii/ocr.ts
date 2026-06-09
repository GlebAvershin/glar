/**
 * OurApp — локальное распознавание текста на сканах (OCR) для маскирования ПДн.
 *
 * Зачем: PII-детекторы (ТЗ-04) работают с текстом, но паспорта/документы часто
 * загружаются СКАНАМИ (картинки). Чтобы найти и замаскировать ПДн в скане, текст
 * надо распознать ЛОКАЛЬНО — иначе картинка с ПДн уйдёт в облачную модель до
 * маскирования (нарушение 152-ФЗ).
 *
 * Поток: скан → ocrImageToText (Tesseract.js, на машине юзера) → текст →
 * существующее маскирование (masker.ts) → в модель уходит обезличенный текст.
 *
 * Worker создаётся лениво при первом распознавании и переиспользуется (создание
 * ~1-2с + загрузка языковых данных). Языки: русский + английский.
 *
 * NB: в dev языковые данные тянутся с CDN tesseract.js. Для offline-сборки
 * (desktop prod) позже укажем langPath на локальные *.traineddata.
 */
import { createWorker, type Worker } from "tesseract.js"

export interface OcrResult {
  text: string
  /** Средняя уверенность распознавания 0..100. */
  confidence: number
}

let workerPromise: Promise<Worker> | null = null

// Локальные ресурсы Tesseract (public/) — для OFFLINE-работы (prod desktop-сборка
// не имеет доступа к CDN; ПДн-маскирование сканов должно работать без интернета).
// В dev vite отдаёт public/ с корня; в prod electron-vite копирует в renderer.
// worker.min.js + core wasm + *.traineddata.gz лежат в public/tesseract и /tessdata.
const OCR_PATHS = {
  workerPath: "/tesseract/worker.min.js",
  corePath: "/tesseract",
  langPath: "/tessdata",
}

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    // oem=1 (LSTM). Языки и движок берутся локально (см. OCR_PATHS) — без CDN.
    workerPromise = createWorker("rus+eng", 1, {
      ...OCR_PATHS,
      logger: () => {},
    })
  }
  return workerPromise
}

/**
 * Распознать текст на изображении-скане.
 * @param input File / Blob / data-URL / ArrayBuffer изображения.
 * @param onProgress колбэк прогресса 0..1 (для индикатора «Распознаём…»).
 */
export async function ocrImageToText(
  input: File | Blob | string | ArrayBuffer,
  onProgress?: (fraction: number) => void,
): Promise<OcrResult> {
  const worker = await getWorker()

  // tesseract.js v7 принимает File/Blob/dataURL напрямую. ArrayBuffer оборачиваем
  // в Blob (а не Uint8Array — он не входит в ImageLike и не примется типами/рантаймом).
  const source: File | Blob | string =
    input instanceof ArrayBuffer ? new Blob([input]) : (input as File | Blob | string)

  // Подписка на прогресс конкретного распознавания.
  if (onProgress) {
    // worker.setParameters не даёт per-call logger; используем грубую оценку.
    onProgress(0.1)
  }

  const { data } = await worker.recognize(source)
  onProgress?.(1)

  return {
    text: (data.text ?? "").trim(),
    confidence: typeof data.confidence === "number" ? data.confidence : 0,
  }
}

/**
 * Эвристика: похоже ли распознанное на осмысленный документ-текст (а не на
 * фото/скриншот без текста). Если мало букв или низкая уверенность — это,
 * скорее всего, не документ-скан, OCR-маскирование не применяем.
 */
export function looksLikeDocumentScan(result: OcrResult): boolean {
  const letters = (result.text.match(/[\p{L}]/gu) ?? []).length
  // Порог снижен под реальные фото-сканы: они дают низкую уверенность (35-45%)
  // из-за наклона/качества, но текст всё равно несёт ПДн и документную суть.
  // Главное — наличие осмысленного объёма текста (≥30 букв).
  return letters >= 30 && result.confidence >= 25
}

/** Освободить worker (например, при выходе/смене сессии). Не обязательно. */
export async function disposeOcr(): Promise<void> {
  if (workerPromise) {
    const w = await workerPromise
    await w.terminate()
    workerPromise = null
  }
}
