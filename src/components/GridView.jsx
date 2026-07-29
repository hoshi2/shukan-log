import React, { useState, useRef } from 'react'
import { Check, X, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react'
import { todayStr, catColor } from '../data/initialData.js'
import {
  weekdayIdx, dayVal, isDone, dayRate, shortNum, stepFor, stepForUnit,
  habitsForMonth, checkVal, numVal, sub2Val, packVal, weekRate, monthRate, calcStreak,
} from '../utils/calc.js'
import '../styles/grid.css'

function unitLabel(unit) {
  if (unit === '円') return '金額'
  if (unit === 'h') return '時間'
  if (unit === 'kg') return '体重'
  return '数値'
}

function Ring({ pct, color, sub }) {
  const r = 32, c = 2 * Math.PI * r
  const off = c - (pct / 100) * c
  return (
    <div className="ring">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--bg4)" strokeWidth="7" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          transform="rotate(-90 40 40)" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div className="ring-label">
        <span className="ring-pct">{pct}%</span>
        <span className="ring-sub">{sub}</span>
      </div>
    </div>
  )
}

const DOW = ['日', '月', '火', '水', '木', '金', '土']

function shiftMonthStr(m, delta) {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function GridView({ state, setState }) {
  const today = todayStr()
  const curMonth = today.slice(0, 7)
  const todayDay = Number(today.slice(8, 10))

  const [month, setMonth] = useState(curMonth)
  const [week, setWeek] = useState(Math.floor((todayDay - 1) / 7))
  const [edit, setEdit] = useState(null)

  const habits = habitsForMonth(state, month)
  const [y, mo] = month.split('-').map(Number)
  const daysInMonth = new Date(y, mo, 0).getDate()
  const allDays = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1
    const date = `${month}-${String(d).padStart(2, '0')}`
    return { d, date, dow: weekdayIdx(date) }
  })
  const weeks = []
  for (let i = 0; i < allDays.length; i += 7) weeks.push(allDays.slice(i, i + 7))

  const isCurMonth = month === curMonth
  const wk = Math.min(week, weeks.length - 1)
  const days = weeks[wk] || []
  const first = days[0], last = days[days.length - 1]

  // どこまで過去に戻れるか（項目リストがある一番古い月、または今月）
  const setKeys = Object.keys(state.habitSets || {}).sort()
  const earliest = setKeys.length && setKeys[0] < curMonth ? setKeys[0] : curMonth

  function goMonth(delta) {
    const m = shiftMonthStr(month, delta)
    setMonth(m)
    setWeek(m === curMonth ? Math.floor((todayDay - 1) / 7) : 0)
  }
  function goToday() {
    setMonth(curMonth)
    setWeek(Math.floor((todayDay - 1) / 7))
  }

  // ---- 値の更新 ----
  function setVal(date, id, value) {
    setState(prev => {
      const daysObj = { ...prev.days }
      const log = { ...(daysObj[date] || { v: {} }) }
      const v = { ...(log.v || {}) }
      if (value === undefined) delete v[id]
      else v[id] = value
      log.v = v
      daysObj[date] = log
      return { ...prev, days: daysObj }
    })
  }

  function cycleCheck(date, id) {
    const raw = dayVal(state.days, date, id)
    const cur = checkVal(raw)
    const next = cur === undefined ? true : cur === true ? false : undefined
    // チェックだけ回し、数値は絶対に消さない
    setVal(date, id, packVal(next, numVal(raw), sub2Val(raw)))
  }

  function openEdit(date, habit) {
    const raw = dayVal(state.days, date, habit.id)
    const n = numVal(raw)
    const n2 = sub2Val(raw)
    setEdit({ date, habit, value: n != null ? String(n) : '', value2: n2 != null ? String(n2) : '', check: checkVal(raw) })
  }
  const combined = edit && edit.habit.type === 'check' && edit.habit.num
  const hasSub = edit && edit.habit.sub
  function saveEdit() {
    if (!edit) return
    const raw = dayVal(state.days, edit.date, edit.habit.id)
    const n = edit.value === '' ? undefined : Number(edit.value)
    if (combined) {
      // 数値を入れたら自動で「できた（緑）」。明示的に✗を選んだ時だけ✗
      const check = edit.check !== undefined ? edit.check : (n !== undefined ? true : undefined)
      setVal(edit.date, edit.habit.id, packVal(check, n, sub2Val(raw)))
    } else if (edit.habit.sub) {
      // 数値2つ（既存のチェックは保持）
      const n2 = edit.value2 === '' ? undefined : Number(edit.value2)
      setVal(edit.date, edit.habit.id, packVal(checkVal(raw), n, n2))
    } else {
      // 数値を入れたら「✗（やらなかった）」は解除。第2数値は保持
      setVal(edit.date, edit.habit.id, packVal(undefined, n, sub2Val(raw)))
    }
    setEdit(null)
  }
  function markOff() {
    if (!edit) return
    setVal(edit.date, edit.habit.id, false)  // ✗（やらなかった）
    setEdit(null)
  }
  function stepEdit(field, delta) {
    setEdit(e => {
      const cur = Number(e[field] || 0)
      const next = Math.max(0, Math.round((cur + delta) * 10) / 10)
      return { ...e, [field]: String(next) }
    })
  }

  // ---- スワイプで週送り ----
  const touch = useRef(null)
  function onTouchStart(e) { touch.current = e.touches[0].clientX }
  function onTouchEnd(e) {
    if (touch.current == null) return
    const dx = e.changedTouches[0].clientX - touch.current
    if (dx < -45 && wk < weeks.length - 1) setWeek(wk + 1)
    else if (dx > 45 && wk > 0) setWeek(wk - 1)
    touch.current = null
  }

  const label = (dd) => `${mo}/${dd.d}`

  // 下部サマリー（常に「今」の達成率）
  const curHabits = habitsForMonth(state, curMonth)
  const wRate = weekRate(state.days, curHabits)
  const mRate = monthRate(state.days, curHabits)
  const streak = calcStreak(state.days, curHabits)

  return (
    <>
      {/* 月ナビ */}
      <div className="week-nav">
        <button className="week-arrow" onClick={() => goMonth(-1)} disabled={month <= earliest} aria-label="前の月">
          <ChevronLeft size={20} />
        </button>
        <div className="week-title">
          <span className="week-title-main">{y}年 {mo}月</span>
          <span className="week-title-sub">{isCurMonth ? '今月' : month > curMonth ? '未来の月' : '過去の月'}</span>
        </div>
        <button className="week-arrow" onClick={() => goMonth(1)} aria-label="次の月">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* 週ナビ */}
      <div className="week-dots" style={{ marginTop: 12 }}>
        <button className="week-arrow sm" onClick={() => setWeek(w => Math.max(0, w - 1))} disabled={wk === 0} aria-label="前の週">
          <ChevronLeft size={16} />
        </button>
        {weeks.map((_, i) => (
          <button key={i} className={'week-dot' + (i === wk ? ' on' : '')} onClick={() => setWeek(i)} aria-label={`第${i + 1}週`} />
        ))}
        <button className="week-arrow sm" onClick={() => setWeek(w => Math.min(weeks.length - 1, w + 1))} disabled={wk === weeks.length - 1} aria-label="次の週">
          <ChevronRight size={16} />
        </button>
        {!isCurMonth && <button className="week-today" onClick={goToday}>今日へ</button>}
      </div>
      <div className="week-range">{first && last ? `${label(first)}〜${label(last)}` : ''}</div>

      {/* グリッド本体 */}
      <div className="grid-wrap" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <table className="habit-grid">
          <thead>
            <tr>
              <th className="hg-corner">項目</th>
              {days.map(dd => {
                const isToday = dd.date === today
                return (
                  <th key={dd.d} className={'hg-dayhead' + (isToday ? ' today' : '')}>
                    <div className="hg-daynum">{dd.d}</div>
                    <div className={'hg-dow' + (dd.dow === 0 ? ' sun' : dd.dow === 6 ? ' sat' : '')}>{DOW[dd.dow]}</div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {habits.map(h => (
              <tr key={h.id}>
                <td className="hg-name">
                  <span className="hg-cat" style={{ background: catColor(h.cat) }} />
                  <span className="hg-name-txt">
                    {h.name}
                    <span className="hg-name-sub">{h.type === 'check' ? (h.hint || '') : ''}</span>
                  </span>
                </td>
                {days.map(dd => {
                  const isToday = dd.date === today
                  const val = dayVal(state.days, dd.date, h.id)
                  const cellCls = 'hg-cell' + (isToday ? ' today' : '')

                  // ①「できた/できない」のみ
                  if (h.type === 'check' && !h.num) {
                    const c = checkVal(val)
                    const n = numVal(val)
                    return (
                      <td key={dd.d} className={cellCls}>
                        <button
                          className={'hg-check' + (c === true ? ' yes' : c === false ? ' no' : '')}
                          onClick={() => cycleCheck(dd.date, h.id)} aria-label={h.name}
                        >
                          {c === true ? <Check size={15} strokeWidth={3} />
                            : c === false ? <X size={14} strokeWidth={3} />
                            : n !== null ? <span className="hg-leftnum">{shortNum(h, val)}</span> : ''}
                        </button>
                      </td>
                    )
                  }

                  // ②「できた/できない＋数値」
                  if (h.type === 'check' && h.num) {
                    const c = checkVal(val)
                    const n = numVal(val)
                    const has = c !== undefined || n !== null
                    // 数字が入っていれば達成（緑）、✗は赤、空は＋
                    const cls = !has ? ' empty' : c === false ? ' miss' : ' ok'
                    return (
                      <td key={dd.d} className={cellCls}>
                        <button className={'hg-num' + cls} onClick={() => openEdit(dd.date, h)}>
                          {n !== null ? shortNum(h, val) : c === true ? '✓' : c === false ? '✗' : '＋'}
                        </button>
                      </td>
                    )
                  }

                  // ③ 数値 / 記録（✗ で「やらなかった」も記録可）
                  const n = numVal(val)
                  const isRecord = h.type === 'record'
                  let cls, text
                  if (val === false) { cls = ' miss'; text = '✗' }
                  else if (n === null) { cls = ' empty'; text = '＋' }
                  else { cls = isRecord ? ' rec' : isDone(h, val) ? ' ok' : ' miss'; text = shortNum(h, val) }
                  return (
                    <td key={dd.d} className={cellCls}>
                      <button className={'hg-num' + cls} onClick={() => openEdit(dd.date, h)}>{text}</button>
                    </td>
                  )
                })}
              </tr>
            ))}
            {/* 達成率 */}
            <tr className="hg-rate-row">
              <td className="hg-name"><span className="hg-name-txt" style={{ color: 'var(--text2)' }}>達成率</span></td>
              {days.map(dd => {
                const r = dayRate(state.days, dd.date, habits)
                const has = habits.some(h => dayVal(state.days, dd.date, h.id) !== undefined)
                return (
                  <td key={dd.d} className={'hg-cell' + (dd.date === today ? ' today' : '')}>
                    <span className="hg-rate" style={{ color: !has ? 'var(--text3)' : r === 100 ? 'var(--green)' : r >= 50 ? 'var(--gold2)' : 'var(--red)' }}>
                      {has ? r + '%' : '·'}
                    </span>
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid-legend">
        タップで記録：<b className="lg-yes">✓</b> やった・<b className="lg-no">✗</b> できなかった・数値はタップして入力。<br />
        Uberなど数値の項目も、やらなかった日は「✗」にできます。
      </div>

      {/* 全体の達成率（一番下） */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><span className="card-title blue">全体の達成率</span></div>
        <div className="ring-wrap">
          <Ring pct={wRate} color="var(--blue)" sub="週間" />
          <Ring pct={mRate} color="var(--accent)" sub="月間" />
        </div>
      </div>
      <div style={{ margin: '12px 16px 0', color: 'var(--text3)', fontSize: 12, textAlign: 'center' }}>
        全部達成できた日の連続：<b style={{ color: 'var(--text2)' }}>{streak}</b> 日
      </div>

      <div style={{ height: 24 }} />

      {/* 数値入力モーダル */}
      {edit && (
        <div className="modal-back" onClick={() => setEdit(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              {edit.habit.name}
              <span className="modal-date">{edit.date.slice(5).replace('-', '/')}</span>
            </div>

            {combined && (
              <div className="modal-check-row">
                <button className={'modal-check yes' + (edit.check === true ? ' on' : '')}
                  onClick={() => setEdit(x => ({ ...x, check: x.check === true ? undefined : true }))}
                ><Check size={15} strokeWidth={3} /> できた</button>
                <button className={'modal-check no' + (edit.check === false ? ' on' : '')}
                  onClick={() => setEdit(x => ({ ...x, check: x.check === false ? undefined : false }))}
                ><X size={15} strokeWidth={3} /> できなかった</button>
              </div>
            )}

            {hasSub && <div className="modal-row-label">{unitLabel(edit.habit.unit)}</div>}
            <div className="modal-input-row">
              <button className="chip big" onClick={() => stepEdit('value', -stepFor(edit.habit))}><Minus size={16} /></button>
              <input className="input-field big" type="number" inputMode="decimal" autoFocus
                value={edit.value} placeholder="0"
                onChange={e => setEdit(x => ({ ...x, value: e.target.value }))} />
              <span className="modal-unit">{edit.habit.unit}</span>
              <button className="chip big" onClick={() => stepEdit('value', stepFor(edit.habit))}><Plus size={16} /></button>
            </div>

            {hasSub && (
              <>
                <div className="modal-row-label" style={{ marginTop: 10 }}>{unitLabel(edit.habit.sub.unit)}</div>
                <div className="modal-input-row">
                  <button className="chip big" onClick={() => stepEdit('value2', -stepForUnit(edit.habit.sub.unit))}><Minus size={16} /></button>
                  <input className="input-field big" type="number" inputMode="decimal"
                    value={edit.value2} placeholder="0"
                    onChange={e => setEdit(x => ({ ...x, value2: e.target.value }))} />
                  <span className="modal-unit">{edit.habit.sub.unit}</span>
                  <button className="chip big" onClick={() => stepEdit('value2', stepForUnit(edit.habit.sub.unit))}><Plus size={16} /></button>
                </div>
              </>
            )}

            {/* number/record は「やらなかった（✗）」も記録できる */}
            {!combined && (
              <button className="btn btn-red btn-full" style={{ marginTop: 12 }} onClick={markOff}>
                ✗ この日はやらなかった
              </button>
            )}

            <div className="modal-btns">
              <button className="btn btn-ghost" onClick={() => { setVal(edit.date, edit.habit.id, undefined); setEdit(null) }}>クリア（空に）</button>
              <button className="btn btn-blue" onClick={saveEdit}>保存</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
