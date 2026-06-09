// OurApp: window.ourappUnmask регистрируется в app-пакете (ourapp/pii/global.ts)
// и вызывается из ui (components/message-part.tsx) как опциональный hook через
// модульную границу (ui не импортирует из app). Дублируем объявление типа здесь,
// чтобы typecheck ui-пакета проходил. Сигнатура должна совпадать с app/pii/global.ts.
export {}

declare global {
  interface Window {
    ourappUnmask?: (text: string, sessionId?: string) => string
  }
}
