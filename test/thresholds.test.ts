import { describe, expect, it } from 'vitest'
import * as t from '../src/thresholds'

/**
 * Issue #249 — a tabela inteira dos limiares pinada: os rótulos de UI
 * interpolam estas constantes, então drift silencioso aqui muda o que o app
 * considera crítico/atenção sem ninguém notar no diff.
 */
describe('thresholds', () => {
  it('tabela de constantes congelada', () => {
    expect({ ...t }).toEqual({
      PACE_FALLING: 0.5,
      PACE_RISING: 1.5,
      PR_STALE_DAYS: 14,
      PR_STALE_ERROR_COUNT: 5,
      PR_AGE_ERROR_DAYS: 30,
      MERGE_NO_REVIEW_RED: 0.2,
      MERGE_NO_REVIEW_AMBER: 0.1,
      DEV_STALE_DAYS: 21,
      DEV_STALE_ERROR_DAYS: 60,
      REPO_STALE_DAYS: 30,
      REPO_STALE_ERROR_DAYS: 90,
      FIX_HOTSPOT_RED: 0.35,
      FIX_HOTSPOT_AMBER: 0.25,
      FIX_HOTSPOT_MIN_COMMITS: 20,
      UNRELEASED_AMBER: 20,
      UNRELEASED_RED: 50,
      OFF_HOURS_PCT: 0.25,
      OFF_HOURS_WEEKENDS: 3,
      OFF_HOURS_PCT_ATTENTION: 0.15,
      OFF_HOURS_COUNT_ATTENTION: 5,
      OFF_HOURS_MIN_COMMITS: 20,
      OFF_HOURS_WEEK_MIN_COMMITS: 5,
      RELEASE_STALE_DAYS: 30,
      PR_AGE_AMBER: 3,
      PR_AGE_RED: 7,
      DEV_SHARE_RED: 0.7,
      DEV_SHARE_AMBER: 0.5,
      BUS_FACTOR_MIN_COMMITS: 10,
      BUS_FACTOR_TOP_REVIEWER_MIN_REVIEWS: 3,
      BUS_FACTOR_BLIND_SPOT_MIN_REVIEWS: 5,
      BUS_FACTOR_BLIND_SPOT_REVIEW_SHARE: 0.7,
      BUS_FACTOR_RISK_RED: 0.7,
      BUS_FACTOR_RISK_AMBER: 0.5,
      BUS_FACTOR_HIGH_MAX_DEVS: 2,
      REVIEW_BOTTLENECK_MIN_REVIEWS: 5,
      REVIEW_BOTTLENECK_RED: 0.7,
      REVIEW_BOTTLENECK_AMBER: 0.5,
      DELTA_FLAT_PCT: 2,
    })
  })

  it('invariantes: vermelho sempre acima do âmbar, janelas de erro acima das de atenção', () => {
    expect(t.MERGE_NO_REVIEW_RED).toBeGreaterThan(t.MERGE_NO_REVIEW_AMBER)
    expect(t.FIX_HOTSPOT_RED).toBeGreaterThan(t.FIX_HOTSPOT_AMBER)
    expect(t.PR_AGE_RED).toBeGreaterThan(t.PR_AGE_AMBER)
    expect(t.DEV_SHARE_RED).toBeGreaterThan(t.DEV_SHARE_AMBER)
    expect(t.OFF_HOURS_PCT).toBeGreaterThan(t.OFF_HOURS_PCT_ATTENTION)
    expect(t.BUS_FACTOR_RISK_RED).toBeGreaterThan(t.BUS_FACTOR_RISK_AMBER)
    expect(t.REVIEW_BOTTLENECK_RED).toBeGreaterThan(t.REVIEW_BOTTLENECK_AMBER)
    expect(t.DEV_STALE_ERROR_DAYS).toBeGreaterThan(t.DEV_STALE_DAYS)
    expect(t.REPO_STALE_ERROR_DAYS).toBeGreaterThan(t.REPO_STALE_DAYS)
    expect(t.UNRELEASED_RED).toBeGreaterThan(t.UNRELEASED_AMBER)
  })
})
