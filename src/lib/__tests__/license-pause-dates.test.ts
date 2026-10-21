import { describe, it, expect } from 'vitest'
import { planResume, validateResumeDay, pausedThisMonth } from '../license-pause-rules'

describe('pausa de login', () => {
  it('taxa do servidor anda o mesmo tempo pausado (16 → volta dia 3 → vence 7)', () => {
    const plan = planResume(
      {
        suspended_at: '2026-10-16T12:00:00-03:00',
        expires_at: null,
        server_paid_until: '2026-10-20T23:59:59-03:00',
        plan_slug: 'vitalicio',
      },
      new Date('2026-11-03T12:00:00-03:00'),
    )
    expect(plan.newServerPaidUntil).toBe(new Date('2026-11-07T23:59:59-03:00').toISOString())
    expect(plan.panelYmd).toBe('2026-11-07')
  })

  it('mensal devolve os dias que faltavam e o painel ganha +1 dia', () => {
    const plan = planResume(
      {
        suspended_at: '2026-10-10T12:00:00-03:00',
        expires_at: '2026-10-20T12:00:00-03:00',
        server_paid_until: '2026-10-20T12:00:00-03:00',
        plan_slug: 'mensal',
      },
      new Date('2026-10-15T12:00:00-03:00'),
    )
    expect(plan.newExpiresAt).toBe(new Date('2026-10-25T12:00:00-03:00').toISOString())
    expect(plan.panelYmd).toBe('2026-10-26')
  })

  it('pausa máxima de 30 dias e mínima de 1 dia', () => {
    const now = new Date('2026-10-18T12:00:00-03:00')
    expect(validateResumeDay('2026-10-18', now).ok).toBe(false)
    expect(validateResumeDay('2026-10-19', now).ok).toBe(true)
    expect(validateResumeDay('2026-11-17', now).ok).toBe(true)
    expect(validateResumeDay('2026-11-18', now).ok).toBe(false)
  })

  it('1 pausa por mês', () => {
    const now = new Date('2026-10-28T12:00:00-03:00')
    expect(pausedThisMonth('2026-10-02T12:00:00-03:00', now)).toBe(true)
    expect(pausedThisMonth('2026-09-30T12:00:00-03:00', now)).toBe(false)
  })
})
