/**
 * OurApp — валидаторы контрольных сумм для ПДн РФ (ТЗ-04 §4).
 *
 * Без проверки контрольных сумм детекторы ИНН/СНИЛС/ОГРН/карты ловят любые
 * последовательности цифр → шквал false-positives. Каждая функция возвращает
 * true если значение валидно по своему алгоритму.
 */

const onlyDigits = (s: string) => s.replace(/\D/g, "")

/** Контрольная сумма ИНН (10 или 12 цифр). Алгоритм ФНС. */
export function isValidInn(input: string): boolean {
  const d = onlyDigits(input)
  if (d.length === 10) {
    const w = [2, 4, 10, 3, 5, 9, 4, 6, 8, 0]
    let sum = 0
    for (let i = 0; i < 9; i++) sum += parseInt(d[i]!, 10) * w[i]!
    const check = (sum % 11) % 10
    return check === parseInt(d[9]!, 10)
  }
  if (d.length === 12) {
    const w1 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8, 0]
    const w2 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8, 0]
    let s1 = 0
    for (let i = 0; i < 11; i++) s1 += parseInt(d[i]!, 10) * w1[i]!
    const c1 = (s1 % 11) % 10
    let s2 = 0
    for (let i = 0; i < 12; i++) s2 += parseInt(d[i]!, 10) * (w2 as number[])[i]!
    const c2 = (s2 % 11) % 10
    return c1 === parseInt(d[10]!, 10) && c2 === parseInt(d[11]!, 10)
  }
  return false
}

/** Контрольная сумма СНИЛС (XXX-XXX-XXX YY → 11 цифр). */
export function isValidSnils(input: string): boolean {
  const d = onlyDigits(input)
  if (d.length !== 11) return false
  // Контрольное число для номеров < 001-001-998 не считается.
  const num = parseInt(d.slice(0, 9), 10)
  if (num < 1001998) {
    // Номер слишком маленький — контрольная сумма не нужна, но и не валидна по строгим правилам
    return false
  }
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]!, 10) * (9 - i)
  let check: number
  if (sum < 100) check = sum
  else if (sum === 100 || sum === 101) check = 0
  else {
    const m = sum % 101
    check = m === 100 ? 0 : m
  }
  return check === parseInt(d.slice(9, 11), 10)
}

/** Контрольная сумма ОГРН (13) / ОГРНИП (15). */
export function isValidOgrn(input: string): boolean {
  const d = onlyDigits(input)
  if (d.length === 13) {
    const body = d.slice(0, 12)
    const check = parseInt(d[12]!, 10)
    const calc = parseInt(body, 10) % 11
    return calc % 10 === check
  }
  if (d.length === 15) {
    const body = d.slice(0, 14)
    const check = parseInt(d[14]!, 10)
    const calc = parseInt(body, 10) % 13
    return calc % 10 === check
  }
  return false
}

/** Алгоритм Луна (Luhn) — для номеров банковских карт. */
export function isValidLuhn(input: string): boolean {
  const d = onlyDigits(input)
  if (d.length < 13 || d.length > 19) return false
  let sum = 0
  let alt = false
  for (let i = d.length - 1; i >= 0; i--) {
    let n = parseInt(d[i]!, 10)
    if (alt) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    alt = !alt
  }
  return sum % 10 === 0
}

/**
 * Расчётный счёт РФ — 20 цифр, проверка по БИК+корсчёту требует доп. данных.
 * Без БИК делаем только структурную проверку (длина).
 */
export function isValidBankAccountStructure(input: string): boolean {
  const d = onlyDigits(input)
  return d.length === 20
}

/** Структурная проверка паспорта РФ (4+6 цифр). */
export function isValidPassportStructure(input: string): boolean {
  const d = onlyDigits(input)
  return d.length === 10
}
