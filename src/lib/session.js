// US equity session clock for tokenized stock markets.
// Regular 09:30–16:00 ET, extended 04:00–09:30 and 16:00–20:00 ET, closed on
// weekends and between sessions. Handles DST: ET is UTC-5 (EST) or UTC-4 (EDT,
// from the 2nd Sunday of March to the 1st Sunday of November).

export const SESSIONS = {
  regular: { label: 'OPEN', title: 'US market open' },
  extended: { label: 'EXTENDED', title: 'US market extended hours' },
  closed: { label: 'CLOSED', title: 'US market closed' },
}

function nthWeekdayOfMonth(year, month, weekday, n) {
  const first = new Date(Date.UTC(year, month, 1))
  const offset = (weekday - first.getUTCDay() + 7) % 7
  return new Date(Date.UTC(year, month, 1 + offset + (n - 1) * 7))
}

function isDST(date) {
  const y = date.getUTCFullYear()
  const start = nthWeekdayOfMonth(y, 2, 0, 2) // 2nd Sunday of March
  const end = nthWeekdayOfMonth(y, 10, 0, 1) // 1st Sunday of November
  return date >= start && date < end
}

/** 'regular' | 'extended' | 'closed' for the given moment. */
export function marketSession(now = new Date()) {
  const offset = isDST(now) ? 4 : 5
  const et = new Date(now.getTime() - offset * 3600 * 1000)
  const day = et.getUTCDay()
  if (day === 0 || day === 6) return 'closed'
  const minutes = et.getUTCHours() * 60 + et.getUTCMinutes()
  if (minutes >= 240 && minutes < 570) return 'extended' // 04:00–09:30
  if (minutes >= 570 && minutes < 960) return 'regular' // 09:30–16:00
  if (minutes >= 960 && minutes < 1200) return 'extended' // 16:00–20:00
  return 'closed'
}
