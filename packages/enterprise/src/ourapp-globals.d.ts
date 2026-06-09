// OurApp: window.ourappUnmask регистрируется в app-пакете (ourapp/pii/global.ts)
// и вызывается из ui (components/message-part.tsx). enterprise при typecheck
// подтягивает ui-исходники, но глобальное объявление из ui/src/ourapp-globals.d.ts
// не входит в include enterprise — поэтому дублируем его и здесь. Сигнатура должна
// совпадать с app/pii/global.ts и ui/src/ourapp-globals.d.ts.
export {}

declare global {
  interface Window {
    ourappUnmask?: (text: string, sessionId?: string) => string
  }
}
