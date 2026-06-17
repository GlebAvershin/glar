/**
 * OurApp — сценарии для бухгалтеров (ТЗ-01 §2).
 */
import type { Scenario } from "../types"

export const accPrimaryDocCheck: Scenario = {
  id: "acc.primary.check",
  verticals: ["accountant"],
  title: "Проверка первичного документа",
  lede: "УПД, акт, счёт-фактура — реквизиты, корректность НДС, риски для вычета.",
  icon: "checklist",
  feature: true,
  preferredModel: "claude-sonnet",
  // Аналитика проверки реквизитов/НДС, а не новый документ → в чате.
  resultAction: { type: "show_in_chat" },
  steps: [
    {
      id: "document",
      type: "file_upload",
      label: "Загрузите первичный документ",
      hint: "Счёт-фактура, УПД, акт, накладная: PDF / DOCX / XLSX или фото/скан (распознаём локально).",
      accept: [".pdf", ".docx", ".xlsx", ".jpg", ".jpeg", ".png", ".webp"],
      required: true,
    },
    {
      id: "doc_type",
      type: "select",
      label: "Тип документа",
      required: true,
      options: [
        { value: "счёт-фактура", label: "Счёт-фактура" },
        { value: "УПД", label: "УПД" },
        { value: "акт выполненных работ", label: "Акт выполненных работ" },
        { value: "товарная накладная", label: "Товарная накладная (ТОРГ-12)" },
      ],
    },
  ],
  promptTemplate: `Ты — опытный бухгалтер и налоговый консультант (РФ).

Проверь приложенный документ типа «{{doc_type}}».

Проверь и выдай отчёт:
1. Все ли обязательные реквизиты на месте (по ст. 169 НК РФ / ФЗ-402).
2. Корректность НДС: ставка, выделение суммы, итоги.
3. Типичные ошибки оформления, которые приведут к отказу в вычете.
4. Риски при налоговой проверке.

Для каждой найденной проблемы укажи: что не так, где именно, как исправить.
Если документ оформлен корректно — так и напиши.`,
}

export const accFnsReply: Scenario = {
  id: "acc.fns.reply",
  verticals: ["accountant"],
  title: "Ответ на требование ФНС",
  lede: "Структурированный ответ с правовыми основаниями.",
  icon: "comment",
  preferredModel: "claude-sonnet",
  resultAction: { type: "generate_docx", filenameTemplate: "Ответ на требование {{request_number}}" },
  steps: [
    {
      id: "request_type",
      type: "select",
      label: "Тип требования",
      required: true,
      options: [
        { value: "камеральная проверка", label: "Камеральная проверка" },
        { value: "выездная проверка", label: "Выездная проверка" },
        { value: "требование о представлении документов", label: "Требование документов (ст. 93 НК)" },
        { value: "требование пояснений", label: "Требование пояснений (ст. 88 НК)" },
      ],
    },
    { id: "request_number", type: "text", label: "Номер требования", required: true },
    { id: "request_date", type: "date", label: "Дата получения требования" },
    { id: "essence", type: "long_text", label: "Суть требования", required: true, rows: 3 },
    { id: "available_docs", type: "long_text", label: "Какие документы есть в наличии", rows: 2 },
  ],
  promptTemplate: `Ты — налоговый консультант (РФ). Составь ответ на требование ФНС.

Тип требования: {{request_type}}.
Номер требования: {{request_number}}.
{{#request_date}}Дата получения: {{request_date}}.{{/request_date}}
Суть: {{essence}}
{{#available_docs}}В наличии документы: {{available_docs}}.{{/available_docs}}

Составь официальный ответ со ссылками на НК РФ и письма Минфина/ФНС.
Структура: реквизиты (кому/от кого), ссылка на требование, ответ по существу,
перечень приложений, дата и подпись. Деловой стиль.`,
}

export const accTaxCodeExplain: Scenario = {
  id: "acc.nk.explain",
  verticals: ["accountant"],
  title: "Объяснить положение НК",
  lede: "Статья НК или письмо Минфина — простым языком с примерами.",
  icon: "glasses",
  preferredModel: "gigachat-pro",
  resultAction: { type: "show_in_chat" },
  steps: [
    { id: "norm", type: "text", label: "Статья НК РФ или письмо Минфина", required: true, placeholder: "Напр.: ст. 54.1 НК РФ" },
    { id: "context", type: "long_text", label: "Контекст применения", hint: "Необязательно: ваша ситуация.", rows: 3 },
  ],
  promptTemplate: `Объясни на простом языке: {{norm}}.
{{#context}}Контекст применения: {{context}}.{{/context}}

Дай: суть нормы простыми словами, кого она касается, 2-3 типовые ситуации с примерами,
частые ошибки. Избегай канцелярита — пиши как для коллеги.`,
}

export const accCounterpartyCheck: Scenario = {
  id: "acc.counterparty.check",
  verticals: ["accountant"],
  title: "Сверка реквизитов контрагента",
  lede: "Проверка ИНН, КПП, ОГРН, банковских реквизитов на консистентность.",
  icon: "magnifying-glass",
  preferredModel: "gigachat-pro",
  resultAction: { type: "show_in_chat" },
  steps: [
    { id: "requisites", type: "long_text", label: "Реквизиты контрагента", required: true, hint: "ИНН, КПП, ОГРН, банк, БИК, р/с, корсчёт.", rows: 5 },
  ],
  promptTemplate: `Проверь реквизиты контрагента на консистентность (РФ):
{{requisites}}

Проверь:
1. Контрольные суммы ИНН (10 или 12 знаков) и ОГРН/ОГРНИП.
2. Соответствие ИНН ↔ КПП (структура КПП).
3. Соответствие БИК ↔ корреспондентский счёт.
4. Соответствие расчётного счёта банку.

Для каждой проверки выдай: ОК или ошибка с пояснением. В конце — вывод о достоверности.`,
}

export const accExplanatoryNote: Scenario = {
  id: "acc.report.note",
  verticals: ["accountant"],
  title: "Пояснительная записка к отчёту",
  lede: "К бухгалтерской/налоговой отчётности — структура и формулировки.",
  icon: "pencil-line",
  preferredModel: "claude-sonnet",
  resultAction: { type: "generate_docx", filenameTemplate: "Пояснительная записка {{period}}" },
  steps: [
    {
      id: "report_type",
      type: "select",
      label: "Тип отчёта",
      required: true,
      options: [
        { value: "бухгалтерская отчётность (РСБУ)", label: "Бухгалтерская (РСБУ)" },
        { value: "налоговая декларация", label: "Налоговая декларация" },
        { value: "отчётность по МСФО", label: "МСФО" },
      ],
    },
    { id: "period", type: "text", label: "Период", required: true, placeholder: "Напр.: 2025 год / I квартал 2026" },
    { id: "changes", type: "long_text", label: "Существенные изменения и операции", required: true, rows: 4 },
  ],
  promptTemplate: `Ты — главный бухгалтер. Составь пояснительную записку к отчёту.

Тип отчёта: {{report_type}}.
Период: {{period}}.
Существенные изменения и операции: {{changes}}

Сформируй структурированную пояснительную записку: общие сведения, учётная политика
(кратко), пояснения к существенным показателям, расшифровка изменений относительно
прошлого периода. Деловой стиль, со ссылками на ПБУ/НК где уместно.`,
}

export const accTaxCalc: Scenario = {
  id: "acc.tax.calc",
  verticals: ["accountant"],
  title: "Расчёт налогов УСН/ОСН",
  lede: "По режиму, выручке и расходам — пошаговый расчёт налога с пояснением формул и сроков уплаты.",
  icon: "checklist",
  preferredModel: "claude-sonnet",
  resultAction: { type: "show_in_chat" },
  steps: [
    {
      id: "regime",
      type: "select",
      label: "Налоговый режим",
      required: true,
      options: [
        { value: 'УСН «Доходы» (6%)', label: "УСН «Доходы» (6%)" },
        { value: 'УСН «Доходы минус расходы» (15%)', label: "УСН «Доходы − расходы» (15%)" },
        { value: "ОСН (налог на прибыль + НДС)", label: "ОСН (прибыль + НДС)" },
      ],
    },
    {
      id: "period",
      type: "text",
      label: "Период",
      hint: "Например: 1 квартал 2026 / год 2025.",
      required: true,
    },
    {
      id: "revenue",
      type: "text",
      label: "Выручка (доходы) за период, ₽",
      required: true,
    },
    {
      id: "expenses",
      type: "text",
      label: "Расходы за период, ₽",
      hint: "Для УСН «Доходы» можно не заполнять.",
    },
    {
      id: "extra",
      type: "long_text",
      label: "Дополнительно",
      hint: "Необязательно: страховые взносы, авансовые платежи, льготная ставка региона.",
      rows: 2,
    },
  ],
  promptTemplate: `Ты — практикующий бухгалтер и налоговый консультант (РФ, 2026 год).

Режим: {{regime}}
Период: {{period}}
Выручка: {{revenue}} ₽
{{#expenses}}Расходы: {{expenses}} ₽{{/expenses}}
{{#extra}}Дополнительно: {{extra}}{{/extra}}

Сделай пошаговый расчёт налога к уплате. Покажи:
1. Налоговую базу и формулу (с подстановкой чисел).
2. Применимую ставку, минимальный налог для УСН 15% (если применимо).
3. Уменьшение на страховые взносы / авансовые платежи (если указаны).
4. Итоговую сумму к уплате и срок уплаты.
5. Важные оговорки и риски (что проверить, частые ошибки).

Числа округляй до рубля. Предупреди, что расчёт ориентировочный — финальную сумму
сверять с учётной системой и актуальными ставками региона.`,
}

export const accReconciliation: Scenario = {
  id: "acc.reconciliation.act",
  verticals: ["accountant"],
  title: "Шаблон акта сверки",
  lede: "По контрагенту, периоду и итоговым суммам — готовый акт сверки взаиморасчётов в Word.",
  icon: "pencil-line",
  preferredModel: "gigachat-pro",
  resultAction: { type: "generate_docx", filenameTemplate: "Акт сверки — {{counterparty}}" },
  steps: [
    {
      id: "our_org",
      type: "text",
      label: "Наша организация",
      required: true,
    },
    {
      id: "counterparty",
      type: "text",
      label: "Контрагент",
      required: true,
    },
    {
      id: "period",
      type: "text",
      label: "Период сверки",
      hint: "Например: с 01.01.2026 по 31.03.2026.",
      required: true,
    },
    {
      id: "our_balance",
      type: "text",
      label: "Сальдо по нашим данным, ₽",
      hint: "В чью пользу — укажите словами (дебет/кредит).",
      required: true,
    },
    {
      id: "contract",
      type: "text",
      label: "Договор (основание)",
      hint: "Необязательно. Номер и дата договора.",
    },
  ],
  promptTemplate: `Ты — бухгалтер, составляешь акт сверки взаимных расчётов (РФ).

Наша организация: {{our_org}}
Контрагент: {{counterparty}}
Период: {{period}}
Сальдо по нашим данным: {{our_balance}}
{{#contract}}Основание: {{contract}}{{/contract}}

Составь документ «Акт сверки взаимных расчётов». Структура:
- Шапка: наименование, период, между кем.
- Таблица с колонками: дата, документ, дебет, кредит — с пустыми строками для
  заполнения операций обеими сторонами.
- Итоговые строки: обороты за период, сальдо на конец периода (по нашим данным).
- Блок «По данным {{counterparty}}» — пустой для заполнения второй стороной.
- Подписи: руководитель и главбух обеих сторон, места для печатей.

Официально-деловой стиль, нумерация. Где данных нет — поля в квадратных скобках.`,
}

export const ACCOUNTANT_SCENARIOS: Scenario[] = [
  accPrimaryDocCheck,
  accFnsReply,
  accTaxCodeExplain,
  accCounterpartyCheck,
  accExplanatoryNote,
  accTaxCalc,
  accReconciliation,
]
