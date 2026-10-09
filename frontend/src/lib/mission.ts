import type { Round } from './api'

const romanNumerals: [number, string][] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
]

function toRoman(value: number) {
  let rest = value
  let result = ''
  for (const [amount, numeral] of romanNumerals) {
    while (rest >= amount) {
      result += numeral
      rest -= amount
    }
  }
  return result
}

const monthFormat = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })

/** Rounds are shown as missions, numbered in the order they were started: "Mission III". */
export function missionName(round: Round, rounds: Round[]) {
  const number = rounds.length - rounds.findIndex((r) => r.id === round.id)
  return `Mission ${toRoman(number)}`
}

export function missionMonth(round: Round) {
  return monthFormat.format(new Date(round.startedAt))
}
