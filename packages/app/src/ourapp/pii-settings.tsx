/**
 * OurApp — секция «Защита персональных данных» в настройках (ТЗ-04 §7.1).
 *
 * Тумблер маскирования + выбор режима + чекбокс предпросмотра. Хранится в
 * localStorage через settings-store.
 */
import { type Component } from "solid-js"
import {
  piiMode,
  piiPreviewEnabled,
  setPiiMode,
  setPiiPreviewEnabled,
} from "./pii/settings-store"

export const PiiSettingsSection: Component = () => {
  const enabled = () => piiMode() !== "off"

  const toggleEnabled = () => {
    setPiiMode(enabled() ? "off" : "strict")
  }

  return (
    <section class="ourapp-settings__card">
      <div class="ourapp-settings__label">Защита персональных данных</div>
      <p class="ourapp-settings__lede">
        Маскировать ФИО, паспорта, ИНН и другие ПДн перед отправкой в зарубежные
        модели (Claude, GPT). Российские модели (GigaChat, YandexGPT) — данные
        остаются в РФ, маскирование не нужно и отключается автоматически.
      </p>

      <div class="ourapp-settings__row">
        <span class="ourapp-settings__rowLabel">Маскировать ПДн</span>
        <label class="ourapp-toggle">
          <input
            type="checkbox"
            checked={enabled()}
            onChange={toggleEnabled}
            aria-label="Маскировать ПДн перед отправкой"
          />
          <span class="ourapp-toggle__track" aria-hidden>
            <span class="ourapp-toggle__thumb" />
          </span>
        </label>
      </div>

      <div class="ourapp-settings__pills" classList={{ "ourapp-settings__pills--disabled": !enabled() }}>
        <button
          type="button"
          class="ourapp-pill"
          classList={{ "ourapp-pill--active": piiMode() === "strict" }}
          onClick={() => setPiiMode("strict")}
          disabled={!enabled()}
        >
          Строгий
        </button>
        <button
          type="button"
          class="ourapp-pill"
          classList={{ "ourapp-pill--active": piiMode() === "soft" }}
          onClick={() => setPiiMode("soft")}
          disabled={!enabled()}
        >
          Мягкий (паспорт, карта, СНИЛС)
        </button>
      </div>

      <div class="ourapp-settings__row" style={{ "margin-top": "8px" }}>
        <label class="ourapp-checkbox">
          <input
            type="checkbox"
            checked={piiPreviewEnabled()}
            onChange={(e) => setPiiPreviewEnabled(e.currentTarget.checked)}
          />
          <span>Показывать что замаскировано перед отправкой</span>
        </label>
      </div>
    </section>
  )
}
