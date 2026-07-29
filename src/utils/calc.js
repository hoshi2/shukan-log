import { todayStr, SMOKING, HABIT_TEMPLATE } from '../data/initialData.js'

// その月の項目リストを返す。無ければ直前の月から引き継ぎ、無ければテンプレ。
export function habitsForMonth(state, month) {
  const sets = state.habitSets || {}
  if (sets[month]) return sets[month]
  const earlier = Object.keys(sets).filter(k => k < month).sort()
  if (earlier.length) return sets[earlier[earlier.length - 1]]
  const all = Object.keys(sets).sort()
  if (all.length) return sets[all[0]]
  return HABIT_TEMPLATE
}

const KEY = 'stella-command-v1'

// ---- localStorage 保存・読み込み ----
export function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (e) {
    console.error('読み込み失敗', e)
    return null
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
    localStorage.setItem(KEY + '-at', String(Date.now()))
    return true
  } catch (e) {
    console.error('保存失敗', e)
    return false
  }
}

// 最後にローカル保存した時刻（ミリ秒）。無ければ 0。
export function loadSavedAt() {
  const n = Number(localStorage.getItem(KEY + '-at'))
  return Number.isFinite(n) ? n : 0
}

// チェック・数値・第2数値を1つの値にまとめる（既存データを壊さない）
// 何も無ければ undefined（＝クリア）、チェック無しの単独数値はスカラーで返す。
export function packVal(c, n, n2) {
  const hasC = c === true || c === false
  const hasN = n !== null && n !== undefined && n !== '' && !Number.isNaN(Number(n))
  const hasN2 = n2 !== null && n2 !== undefined && n2 !== '' && !Number.isNaN(Number(n2))
  if (!hasC && !hasN && !hasN2) return undefined
  if (!hasC && !hasN2 && hasN) return Number(n)
  const obj = {}
  if (hasC) obj.c = c
  if (hasN) obj.n = Number(n)
  if (hasN2) obj.n2 = Number(n2)
  return obj
}

// ---- 日付ユーティリティ ----
export function daysBetween(fromStr, toStr) {
  const a = new Date(fromStr + 'T00:00:00')
  const b = new Date(toStr + 'T00:00:00')
  return Math.round((b - a) / 86400000)
}

export function shiftDay(str, delta) {
  const d = new Date(str + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  return todayStr(d)
}

export function weekdayJP(str) {
  const d = new Date(str + 'T00:00:00')
  return ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
}

export function weekdayIdx(str) {
  return new Date(str + 'T00:00:00').getDay()
}

// ---- 習慣まわり ----
// その日の生の値を取り出す（scalar か {c,n} オブジェクト）
export function dayVal(days, date, id) {
  return days?.[date]?.v?.[id]
}

// 生の値から「チェック状態」を取り出す（true/false/undefined）
export function checkVal(v) {
  if (v === true) return true
  if (v === false) return false
  if (v && typeof v === 'object') return v.c === true ? true : v.c === false ? false : undefined
  return undefined
}

// 生の値から「数値」を取り出す（無ければ null）
export function numVal(v) {
  if (v == null || v === '' || v === true || v === false) return null
  if (typeof v === 'object') {
    return (v.n == null || v.n === '') ? null : Number(v.n)
  }
  return Number(v)
}

// 生の値から「2つ目の数値（Uberの時間など）」を取り出す（無ければ null）
export function sub2Val(v) {
  if (v && typeof v === 'object') return (v.n2 == null || v.n2 === '') ? null : Number(v.n2)
  return null
}

// 達成率の分母に数えるか（check、または目標つきnumber。record は数えない）
export function countsForRate(habit) {
  return habit.type === 'check' || (habit.type === 'number' && habit.target != null && habit.target !== '')
}

// その習慣がその日に「達成」したか
export function isDone(habit, val) {
  if (val === undefined || val === null || val === '') return false
  if (habit.type === 'check') return checkVal(val) === true
  if (habit.type === 'record') return false
  // number
  const n = numVal(val)
  if (n === null) return false
  if (habit.target != null && habit.target !== '') return n >= Number(habit.target)
  return true // 目標なしの数値は「入力があれば達成扱い」
}

// その日のタスク達成率（%）
export function dayRate(days, date, habits) {
  const core = habits.filter(countsForRate)
  if (core.length === 0) return 0
  const done = core.filter(h => isDone(h, dayVal(days, date, h.id))).length
  return Math.round((done / core.length) * 100)
}

// ストリーク（連続で「全部達成した日」が続いた数）
export function calcStreak(days, habits) {
  let streak = 0
  let cursor = todayStr()
  for (let i = 0; i < 400; i++) {
    const rate = dayRate(days, cursor, habits)
    if (rate === 100) {
      streak++
      cursor = shiftDay(cursor, -1)
    } else {
      if (i === 0) { cursor = shiftDay(cursor, -1); continue }
      break
    }
  }
  return streak
}

export function weekRate(days, habits) {
  let sum = 0
  for (let i = 0; i < 7; i++) sum += dayRate(days, shiftDay(todayStr(), -i), habits)
  return Math.round(sum / 7)
}

export function monthRate(days, habits) {
  let sum = 0
  for (let i = 0; i < 30; i++) sum += dayRate(days, shiftDay(todayStr(), -i), habits)
  return Math.round(sum / 30)
}

// check習慣：今日（未入力なら昨日）から遡って ✓ が続く数
export function checkStreak(days, id) {
  let streak = 0
  let cursor = todayStr()
  for (let i = 0; i < 400; i++) {
    const c = checkVal(dayVal(days, cursor, id))
    if (c === true) {
      streak++
      cursor = shiftDay(cursor, -1)
    } else if (c === false) {
      break
    } else {
      if (i === 0) { cursor = shiftDay(cursor, -1); continue }
      break
    }
  }
  return streak
}

// ---- 集計（指定 年月 "YYYY-MM"、省略で今月）----
function ym(month) { return month || todayStr().slice(0, 7) }

// number習慣の合計
export function monthSum(days, id, month) {
  const m = ym(month)
  let sum = 0
  for (const [date, log] of Object.entries(days || {})) {
    if (!date.startsWith(m)) continue
    const n = numVal(log?.v?.[id])
    if (n !== null) sum += n
  }
  return Math.round(sum * 10) / 10
}

// number習慣の累計（全期間）
export function totalSum(days, id) {
  let sum = 0
  for (const log of Object.values(days || {})) {
    const n = numVal(log?.v?.[id])
    if (n !== null) sum += n
  }
  return Math.round(sum * 10) / 10
}

// 2つ目の数値（Uber時間など）の月合計
export function monthSub2Sum(days, id, month) {
  const m = ym(month)
  let sum = 0
  for (const [date, log] of Object.entries(days || {})) {
    if (!date.startsWith(m)) continue
    const n = sub2Val(log?.v?.[id])
    if (n !== null) sum += n
  }
  return Math.round(sum * 10) / 10
}

// number習慣で「値が入った日数」（Uberの稼働回数など）
export function monthWorkedDays(days, id, month) {
  const m = ym(month)
  let n = 0
  for (const [date, log] of Object.entries(days || {})) {
    if (!date.startsWith(m)) continue
    const v = numVal(log?.v?.[id])
    if (v !== null && v > 0) n++
  }
  return n
}

// check習慣の達成日数
export function monthDoneCount(days, id, month) {
  const m = ym(month)
  let n = 0
  for (const [date, log] of Object.entries(days || {})) {
    if (date.startsWith(m) && checkVal(log?.v?.[id]) === true) n++
  }
  return n
}

// number習慣の最新値
export function latestVal(days, id) {
  const dates = Object.keys(days || {}).filter(d => numVal(days[d]?.v?.[id]) !== null).sort()
  const last = dates[dates.length - 1]
  return last ? numVal(days[last].v[id]) : null
}

// number習慣の時系列（グラフ用）
export function numberSeries(days, id) {
  return Object.keys(days || {})
    .filter(d => numVal(days[d]?.v?.[id]) !== null)
    .sort()
    .map(d => ({ date: d.slice(5), value: numVal(days[d].v[id]) }))
}

// 禁煙：節約額・本数
export function smokingStats(days, id = 'no-smoke') {
  const streak = checkStreak(days, id)
  const cigsAvoided = streak * SMOKING.cigsPerDayBefore
  const yenPerCig = SMOKING.pricePerPack / SMOKING.cigsPerPack
  const saved = Math.round(cigsAvoided * yenPerCig)
  return { days: streak, cigsAvoided, saved }
}

export function yen(n) {
  return '¥' + Math.round(n).toLocaleString('ja-JP')
}

// number習慣の値をセル用に短く整形（円→k表記）
export function shortNum(habit, v) {
  const n = numVal(v)
  if (n === null) return ''
  if (habit.unit === '円') return (Math.round(n / 100) / 10) + 'k'
  return String(n)
}

// 単位から入力ステップを推定
export function stepForUnit(unit) {
  if (unit === '円') return 1000
  if (unit === 'kg') return 0.1
  if (unit === 'h') return 0.5
  return 1
}
export function stepFor(habit) {
  return stepForUnit(habit.unit)
}
