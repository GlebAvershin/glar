/**
 * OurApp — сценарии для юристов (ТЗ-01 §2).
 */
import type { Scenario } from "../types"

export const lawyerContractReview: Scenario = {
  id: "law.contract.review",
  verticals: ["lawyer"],
  title: "Проверка договора на риски",
  lede: "Загрузите договор — получите пронумерованный список рисков со ссылкой на пункты и готовыми правками.",
  icon: "shield",
  feature: true,
  preferredModel: "claude-sonnet",
  // Аналитический отчёт о рисках, а не новый документ → показываем в чате.
  // Юзер при желании скачает .docx кнопкой, если ответ структурирован.
  resultAction: { type: "show_in_chat" },
  steps: [
    {
      id: "document",
      type: "file_upload",
      label: "Загрузите договор",
      hint: "PDF, DOCX или фото/скан (распознаём текст локально). Сканы точнее на Claude Sonnet/Opus.",
      accept: [".pdf", ".docx", ".jpg", ".jpeg", ".png", ".webp"],
      required: true,
    },
    {
      id: "party_side",
      type: "select",
      label: "Чьи интересы защищаем?",
      required: true,
      options: [
        { value: "заказчика", label: "Заказчик / покупатель" },
        { value: "исполнителя", label: "Исполнитель / поставщик" },
        { value: "обеих сторон (нейтрально)", label: "Нейтральная оценка" },
      ],
    },
    {
      id: "focus",
      type: "long_text",
      label: "На что обратить особое внимание?",
      hint: "Необязательно. Например: ответственность, сроки, штрафы, расторжение.",
      rows: 3,
    },
  ],
  promptTemplate: `Ты — опытный юрист с 15+ лет практики в коммерческом праве РФ.

Задача: проверить приложенный договор на риски для стороны «{{party_side}}».

Прочитай документ и выдай нумерованный список рисков. Для каждого риска укажи:
1. Номер пункта договора.
2. Оценку серьёзности: высокий / средний / низкий.
3. В чём именно проблема.
4. Конкретное предложение по правке формулировки.
{{#focus}}
Особое внимание удели: {{focus}}.
{{/focus}}

В конце — краткое резюме: стоит ли подписывать в текущей редакции. Используй заголовки и нумерацию.`,
}

export const lawyerContractDraft: Scenario = {
  id: "law.contract.draft",
  verticals: ["lawyer"],
  title: "Составить договор",
  lede: "По параметрам сделки — готовый проект договора в Word.",
  icon: "pencil-line",
  preferredModel: "claude-sonnet",
  resultAction: { type: "generate_docx", filenameTemplate: "Договор {{contract_type}}" },
  steps: [
    {
      id: "contract_type",
      type: "select",
      label: "Тип договора",
      required: true,
      options: [
        { value: "оказания услуг", label: "Оказания услуг" },
        { value: "поставки", label: "Поставки" },
        { value: "аренды", label: "Аренды" },
        { value: "о неразглашении (NDA)", label: "NDA (о неразглашении)" },
        { value: "подряда", label: "Подряда" },
      ],
    },
    {
      id: "parties",
      type: "long_text",
      label: "Стороны договора",
      hint: "Наименования, ИНН, кто заказчик/исполнитель.",
      required: true,
      rows: 3,
    },
    { id: "subject", type: "long_text", label: "Предмет договора", required: true, rows: 3 },
    { id: "price", type: "text", label: "Цена и порядок оплаты", placeholder: "Напр.: 100 000 ₽, постоплата 5 дней" },
    { id: "term", type: "text", label: "Срок действия / исполнения", placeholder: "Напр.: до 31.12.2026" },
    {
      id: "special",
      type: "long_text",
      label: "Особые условия",
      hint: "Необязательно: ответственность, форс-мажор, неустойка.",
      rows: 3,
    },
  ],
  promptTemplate: `Ты — юрист, составляющий договоры по праву РФ.

Составь проект договора {{contract_type}}.

Стороны: {{parties}}
Предмет: {{subject}}
{{#price}}Цена и оплата: {{price}}{{/price}}
{{#term}}Срок: {{term}}{{/term}}
{{#special}}Особые условия: {{special}}{{/special}}

Сформируй полный текст договора в официально-деловом стиле со ссылками на статьи ГК РФ.
Структура: преамбула, предмет, права и обязанности, цена и порядок расчётов, ответственность,
форс-мажор, срок действия, реквизиты сторон. Используй нумерацию пунктов.`,
}

export const lawyerClaim: Scenario = {
  id: "law.claim.draft",
  verticals: ["lawyer"],
  title: "Подготовить претензию",
  lede: "Досудебная претензия по форме РФ со ссылками на ГК.",
  icon: "comment",
  preferredModel: "claude-sonnet",
  resultAction: { type: "generate_docx", filenameTemplate: "Претензия — {{recipient}}" },
  steps: [
    { id: "recipient", type: "text", label: "Кому адресована претензия", required: true, placeholder: "Наименование, ИНН" },
    { id: "basis", type: "long_text", label: "Основание (договор, накладная, дата)", required: true, rows: 2 },
    { id: "violation", type: "long_text", label: "В чём нарушение", required: true, rows: 3 },
    { id: "demand", type: "long_text", label: "Что требуем", required: true, rows: 2 },
    { id: "deadline_days", type: "text", label: "Срок исполнения (дней)", placeholder: "Напр.: 10" },
    {
      id: "has_attached_contract",
      type: "file_upload",
      label: "Приложить договор (необязательно)",
      accept: [".pdf", ".docx", ".jpg", ".jpeg", ".png", ".webp"],
    },
  ],
  promptTemplate: `Ты — опытный юрист. Подготовь досудебную претензию по праву РФ.

Получатель: {{recipient}}
Основание: {{basis}}
Нарушение: {{violation}}
Требование: {{demand}}
{{#deadline_days}}Срок исполнения: {{deadline_days}} дней.{{/deadline_days}}
{{#has_attached_contract}}К претензии приложен договор — учти его условия.{{/has_attached_contract}}

Сформируй текст претензии в официально-деловом стиле со ссылками на статьи ГК РФ.
Структура: реквизиты сторон, описание нарушения, юридическая квалификация, требования,
срок исполнения, последствия неисполнения (обращение в суд). Нумеруй пункты.`,
}

export const lawyerCompareVersions: Scenario = {
  id: "law.diff.versions",
  verticals: ["lawyer"],
  title: "Сравнить две редакции",
  lede: "Что изменилось между версиями договора и в чью пользу.",
  icon: "review",
  preferredModel: "claude-sonnet",
  // Сравнительный отчёт (таблица различий), а не новый документ → в чате.
  resultAction: { type: "show_in_chat" },
  steps: [
    { id: "version_a", type: "file_upload", label: "Первая редакция", accept: [".pdf", ".docx", ".jpg", ".jpeg", ".png", ".webp"], required: true },
    { id: "version_b", type: "file_upload", label: "Вторая редакция", accept: [".pdf", ".docx", ".jpg", ".jpeg", ".png", ".webp"], required: true },
    {
      id: "party_side",
      type: "select",
      label: "Чьи интересы оцениваем?",
      required: true,
      options: [
        { value: "заказчика", label: "Заказчик" },
        { value: "исполнителя", label: "Исполнитель" },
      ],
    },
  ],
  promptTemplate: `Ты — юрист. Сравни две приложенные редакции одного документа.

Выдай структурированную таблицу изменений: что добавлено, что удалено, что изменено.
Для каждого изменения оцени, в чью пользу оно работает — в пользу стороны «{{party_side}}» или против.
В конце — вывод: какая редакция выгоднее для стороны «{{party_side}}» и почему.`,
}

export const lawyerSummary: Scenario = {
  id: "law.summary.short",
  verticals: ["lawyer"],
  title: "Краткое содержание документа",
  lede: "Длинный документ — на одну страницу, с существенными пунктами.",
  icon: "bullet-list",
  preferredModel: "gigachat-pro",
  resultAction: { type: "show_in_chat" },
  steps: [
    { id: "document", type: "file_upload", label: "Загрузите документ", accept: [".pdf", ".docx", ".jpg", ".jpeg", ".png", ".webp"], required: true },
    {
      id: "purpose",
      type: "text",
      label: "Зачем нужно саммари?",
      hint: "Необязательно. Напр.: для совещания, для клиента.",
    },
  ],
  promptTemplate: `Прочитай приложенный документ и сделай краткое содержание на одну страницу.
{{#purpose}}Контекст использования: {{purpose}}.{{/purpose}}

Структура: о чём документ, ключевые стороны, существенные условия, сроки и суммы,
риски (если видишь). Пиши простым деловым языком, без воды.`,
}

export const lawyerLawsuit: Scenario = {
  id: "law.lawsuit.draft",
  verticals: ["lawyer"],
  title: "Подготовить исковое заявление",
  lede: "По сути спора и требованиям — проект искового со ссылками на нормы и расчётом цены иска.",
  icon: "pencil-line",
  preferredModel: "claude-opus",
  resultAction: { type: "generate_docx", filenameTemplate: "Исковое заявление" },
  steps: [
    {
      id: "court",
      type: "text",
      label: "В какой суд подаётся иск?",
      hint: "Например: Арбитражный суд г. Москвы / районный суд.",
      required: true,
    },
    {
      id: "plaintiff",
      type: "text",
      label: "Истец (наименование / ФИО)",
      required: true,
    },
    {
      id: "defendant",
      type: "text",
      label: "Ответчик (наименование / ФИО)",
      required: true,
    },
    {
      id: "dispute",
      type: "long_text",
      label: "Суть спора",
      hint: "Что произошло, чем нарушены права, чем подтверждается.",
      rows: 5,
      required: true,
    },
    {
      id: "claims",
      type: "long_text",
      label: "Исковые требования",
      hint: "Что просите взыскать/обязать. Суммы, если есть.",
      rows: 3,
      required: true,
    },
    {
      id: "evidence",
      type: "long_text",
      label: "Доказательства (приложения)",
      hint: "Необязательно. Договор, акты, переписка и т.п.",
      rows: 3,
    },
  ],
  promptTemplate: `Ты — опытный юрист-процессуалист (РФ, гражданский и арбитражный процесс).

Подготовь проект искового заявления.

Суд: {{court}}
Истец: {{plaintiff}}
Ответчик: {{defendant}}
Суть спора: {{dispute}}
Требования: {{claims}}
{{#evidence}}Доказательства: {{evidence}}{{/evidence}}

Структура: шапка (суд, стороны, цена иска), описательная часть (обстоятельства),
правовое обоснование со ссылками на нормы ГК/АПК/ГПК РФ, просительная часть
(пронумерованные требования), перечень приложений. Деловой стиль, нумерация пунктов.
Где данных не хватает — оставь поле в квадратных скобках для заполнения.`,
}

export const lawyerCounterpartyCheck: Scenario = {
  id: "law.counterparty.check",
  verticals: ["lawyer"],
  title: "Проверка контрагента по реквизитам",
  lede: "По ИНН/ОГРН — структура анализа благонадёжности: на что смотреть, какие риски, что запросить.",
  icon: "magnifying-glass",
  preferredModel: "claude-sonnet",
  resultAction: { type: "show_in_chat" },
  steps: [
    {
      id: "inn",
      type: "text",
      label: "ИНН или ОГРН контрагента",
      hint: "Можно вставить известные реквизиты или выписку.",
      required: true,
    },
    {
      id: "context",
      type: "long_text",
      label: "Контекст сделки",
      hint: "Необязательно. Что планируете, на какую сумму, разовая или долгосрочная.",
      rows: 3,
    },
  ],
  promptTemplate: `Ты — юрист по комплаенсу и проверке контрагентов (РФ).

Контрагент: {{inn}}
{{#context}}Контекст сделки: {{context}}{{/context}}

Составь чек-лист проверки благонадёжности и анализ рисков. Разделы:
1. Что проверить в открытых источниках (ЕГРЮЛ, картотека арбитража, ФССП, реестр
   недобросовестных поставщиков, банкротство) — и на какой признак риска смотреть.
2. Красные флаги (массовый адрес, дисквалифицированный директор, частая смена
   учредителей, судебные иски, налоговые долги).
3. Какие документы запросить у контрагента перед сделкой.
4. Рекомендации по снижению риска (авансы, обеспечение, оговорки в договоре).

Это методология проверки (без доступа к live-базам). Структурируй заголовками.`,
}

export const LAWYER_SCENARIOS: Scenario[] = [
  lawyerContractReview,
  lawyerContractDraft,
  lawyerClaim,
  lawyerCompareVersions,
  lawyerSummary,
  lawyerLawsuit,
  lawyerCounterpartyCheck,
]
