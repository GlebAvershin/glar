/**
 * OurApp — рендереры шагов мастера (ТЗ-01 §4.3).
 *
 * Все 6 типов в одном файле — они маленькие и тесно связаны. Каждый получает
 * текущее значение и колбэк onChange. Стили — scenario-wizard.css.
 */
import { For, Show, type Component } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"
import type {
  BooleanStep,
  DateStep,
  FileUploadStep,
  LongTextStep,
  ScenarioStep,
  SelectStep,
  StepValue,
  TextStep,
} from "./types"

interface StepProps<V = StepValue> {
  step: ScenarioStep
  value: V
  onChange: (value: StepValue) => void
}

export const ScenarioStepField: Component<StepProps> = (props) => {
  return (
    <div class="ourapp-wiz__field">
      <label class="ourapp-wiz__label">
        {props.step.label}
        <Show when={props.step.required}>
          <span class="ourapp-wiz__required" aria-hidden>
            {" "}
            *
          </span>
        </Show>
      </label>
      <Show when={props.step.hint}>
        <p class="ourapp-wiz__hint">{props.step.hint}</p>
      </Show>
      {renderStep(props)}
    </div>
  )
}

function renderStep(props: StepProps) {
  switch (props.step.type) {
    case "text":
      return <TextField {...(props as StepProps<string | undefined>)} />
    case "long_text":
      return <LongTextField {...(props as StepProps<string | undefined>)} />
    case "select":
      return <SelectField {...(props as StepProps<string | undefined>)} />
    case "file_upload":
      return <FileUploadField {...(props as StepProps<File[] | undefined>)} />
    case "boolean":
      return <BooleanField {...(props as StepProps<boolean | undefined>)} />
    case "date":
      return <DateField {...(props as StepProps<string | undefined>)} />
  }
}

const TextField: Component<StepProps<string | undefined>> = (props) => {
  const step = props.step as TextStep
  return (
    <input
      type="text"
      class="ourapp-wiz__input"
      value={props.value ?? ""}
      placeholder={step.placeholder}
      maxLength={step.maxLength}
      onInput={(e) => props.onChange(e.currentTarget.value)}
    />
  )
}

const LongTextField: Component<StepProps<string | undefined>> = (props) => {
  const step = props.step as LongTextStep
  return (
    <textarea
      class="ourapp-wiz__textarea"
      rows={step.rows ?? 4}
      value={props.value ?? ""}
      placeholder={step.placeholder}
      onInput={(e) => props.onChange(e.currentTarget.value)}
    />
  )
}

const SelectField: Component<StepProps<string | undefined>> = (props) => {
  const step = props.step as SelectStep
  return (
    <div class="ourapp-wiz__radios" role="radiogroup" aria-label={step.label}>
      <For each={step.options}>
        {(opt) => (
          <button
            type="button"
            class="ourapp-wiz__radio"
            classList={{ "ourapp-wiz__radio--active": props.value === opt.value }}
            role="radio"
            aria-checked={props.value === opt.value}
            onClick={() => props.onChange(opt.value)}
          >
            <span class="ourapp-wiz__radioDot" aria-hidden />
            <span class="ourapp-wiz__radioBody">
              <span class="ourapp-wiz__radioLabel">{opt.label}</span>
              <Show when={opt.description}>
                <span class="ourapp-wiz__radioDesc">{opt.description}</span>
              </Show>
            </span>
          </button>
        )}
      </For>
    </div>
  )
}

const FileUploadField: Component<StepProps<File[] | undefined>> = (props) => {
  const step = props.step as FileUploadStep
  let inputRef: HTMLInputElement | undefined

  const files = () => props.value ?? []

  const onPick = (list: FileList | null) => {
    if (!list) return
    const picked = Array.from(list)
    props.onChange(step.multiple ? [...files(), ...picked] : picked.slice(0, 1))
  }

  const removeAt = (idx: number) => {
    const next = files().filter((_, i) => i !== idx)
    props.onChange(next.length > 0 ? next : undefined)
  }

  return (
    <div class="ourapp-wiz__upload">
      <input
        ref={(el) => (inputRef = el)}
        type="file"
        class="ourapp-wiz__uploadInput"
        accept={step.accept.join(",")}
        multiple={step.multiple}
        onChange={(e) => {
          onPick(e.currentTarget.files)
          e.currentTarget.value = ""
        }}
      />
      <button type="button" class="ourapp-wiz__uploadBtn" onClick={() => inputRef?.click()}>
        <Icon name="folder" class="size-4" />
        {files().length > 0 && step.multiple ? "Добавить ещё файл" : "Выбрать файл"}
        <span class="ourapp-wiz__uploadFormats">{step.accept.join(" · ")}</span>
      </button>
      <Show when={files().length > 0}>
        <ul class="ourapp-wiz__fileList">
          <For each={files()}>
            {(f, i) => (
              <li class="ourapp-wiz__fileItem">
                <Icon name="folder" class="size-3.5 text-text-weak shrink-0" />
                <span class="ourapp-wiz__fileName">{f.name}</span>
                <button
                  type="button"
                  class="ourapp-wiz__fileRemove"
                  aria-label="Убрать файл"
                  onClick={() => removeAt(i())}
                >
                  <Icon name="close-small" class="size-3.5" />
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  )
}

const BooleanField: Component<StepProps<boolean | undefined>> = (props) => {
  const _step = props.step as BooleanStep
  return (
    <div class="ourapp-wiz__radios">
      <button
        type="button"
        class="ourapp-wiz__radio"
        classList={{ "ourapp-wiz__radio--active": props.value === true }}
        onClick={() => props.onChange(true)}
      >
        <span class="ourapp-wiz__radioDot" aria-hidden />
        <span class="ourapp-wiz__radioLabel">Да</span>
      </button>
      <button
        type="button"
        class="ourapp-wiz__radio"
        classList={{ "ourapp-wiz__radio--active": props.value === false }}
        onClick={() => props.onChange(false)}
      >
        <span class="ourapp-wiz__radioDot" aria-hidden />
        <span class="ourapp-wiz__radioLabel">Нет</span>
      </button>
    </div>
  )
}

const DateField: Component<StepProps<string | undefined>> = (props) => {
  const _step = props.step as DateStep
  return (
    <input
      type="date"
      class="ourapp-wiz__input"
      value={props.value ?? ""}
      onInput={(e) => props.onChange(e.currentTarget.value)}
    />
  )
}
