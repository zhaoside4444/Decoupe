// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  COMPARE_RATIO_DEFAULT,
  COMPARE_RATIO_KEY,
  COMPARE_RATIO_MAX,
  COMPARE_RATIO_MIN,
  clampCompareRatio,
  loadCompareRatio,
  saveCompareRatio
} from '../src/renderer/src/compare'

beforeEach(() => {
  window.localStorage.clear()
})

describe('compare — ratio des panneaux', () => {
  it('borne le ratio entre les valeurs prévues', () => {
    expect(clampCompareRatio(0.1)).toBe(COMPARE_RATIO_MIN)
    expect(clampCompareRatio(0.9)).toBe(COMPARE_RATIO_MAX)
    expect(clampCompareRatio(0.5)).toBe(0.5)
    expect(clampCompareRatio(Number.NaN)).toBe(COMPARE_RATIO_DEFAULT)
  })

  it('retombe sur la valeur par défaut sans préférence enregistrée', () => {
    expect(loadCompareRatio()).toBe(COMPARE_RATIO_DEFAULT)
  })

  it('mémorise et relit un ratio valide', () => {
    saveCompareRatio(0.55)
    expect(window.localStorage.getItem(COMPARE_RATIO_KEY)).toBe('0.55')
    expect(loadCompareRatio()).toBe(0.55)
  })

  it('borne le ratio enregistré et ignore une valeur illisible', () => {
    saveCompareRatio(5)
    expect(loadCompareRatio()).toBe(COMPARE_RATIO_MAX)

    window.localStorage.setItem(COMPARE_RATIO_KEY, 'beaucoup')
    expect(loadCompareRatio()).toBe(COMPARE_RATIO_DEFAULT)
  })
})
