import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AlcoholConsumptionSummary } from '../../../../frontend/src/features/drinks/components/AlcoholConsumptionSummary'
import type { AlcoholConsumptionSummary as Summary } from '../../../../frontend/src/features/drinks/calculations/alcoholConsumptionSummary'
import { ALCOHOL_GUIDELINES_RESPONSE } from '../fixtures/alcoholGuidelineFixture'

function hasExactText(expected: string) {
  return (_content: string, element: Element | null) =>
    element?.textContent?.replace(/\s+/g, ' ').trim() === expected
}

function summary(overrides: Partial<Summary> = {}): Summary {
  return {
    hasEligibleDrinkingRecordToday: true,
    dailyStandardDrinks: 1.479375,
    rollingSevenDayStandardDrinks: 2.95875,
    earliestRecordedConsumptionDate: '2026-09-02',
    recordedHistorySpanDays: 1,
    recordedHistorySpanStatus: 'under-seven-days',
    excludedFutureRecordCount: 0,
    ...overrides,
  }
}

describe('AlcoholConsumptionSummary', () => {
  it('shows no-history feedback without presenting zero guideline comparisons', () => {
    render(
      <AlcoholConsumptionSummary
        summary={summary({
          hasEligibleDrinkingRecordToday: false,
          dailyStandardDrinks: 0,
          rollingSevenDayStandardDrinks: 0,
          earliestRecordedConsumptionDate: null,
          recordedHistorySpanDays: 0,
          recordedHistorySpanStatus: 'none',
        })}
        guidelines={ALCOHOL_GUIDELINES_RESPONSE}
        guidelineStatus="loaded"
        onRetryGuidelines={() => undefined}
      />,
    )

    expect(
      screen.getByText(/No current or past drinking history/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/0\.0 \/ 10/)).not.toBeInTheDocument()
    expect(screen.queryByText(/0\.0 \/ 4/)).not.toBeInTheDocument()
  })

  it('explains future-only exclusion without changing stored history', () => {
    render(
      <AlcoholConsumptionSummary
        summary={summary({
          hasEligibleDrinkingRecordToday: false,
          dailyStandardDrinks: 0,
          rollingSevenDayStandardDrinks: 0,
          earliestRecordedConsumptionDate: null,
          recordedHistorySpanDays: 0,
          recordedHistorySpanStatus: 'none',
          excludedFutureRecordCount: 2,
        })}
        guidelines={ALCOHOL_GUIDELINES_RESPONSE}
        guidelineStatus="loaded"
        onRetryGuidelines={() => undefined}
      />,
    )

    expect(
      screen.getByText(/2 records are excluded because their dates are in the future/i),
    ).toBeInTheDocument()
  })

  it('shows the daily comparison but not a weekly denominator under seven days', () => {
    render(
      <AlcoholConsumptionSummary
        summary={summary({ recordedHistorySpanDays: 3 })}
        guidelines={ALCOHOL_GUIDELINES_RESPONSE}
        guidelineStatus="loaded"
        onRetryGuidelines={() => undefined}
      />,
    )

    expect(
      screen.getByText(hasExactText('1.5 / 4 standard drinks')),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/3 days of available history/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Missing records are not treated as zero consumption/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/\/ 10 standard drinks/)).not.toBeInTheDocument()
    expect(screen.queryByText(/complete drinking history/i)).not.toBeInTheDocument()
  })

  it('qualifies a zero Today comparison as recorded data', () => {
    render(
      <AlcoholConsumptionSummary
        summary={summary({
          hasEligibleDrinkingRecordToday: false,
          dailyStandardDrinks: 0,
          earliestRecordedConsumptionDate: '2026-09-01',
          recordedHistorySpanDays: 2,
        })}
        guidelines={ALCOHOL_GUIDELINES_RESPONSE}
        guidelineStatus={'loaded'}
        onRetryGuidelines={() => undefined}
      />,
    )

    expect(
      screen.getByText(
        hasExactText('0.0 / 4 standard drinks recorded today'),
      ),
    ).toBeInTheDocument()
  })

  it('shows a rolling seven-local-day comparison when the span is available', () => {
    render(
      <AlcoholConsumptionSummary
        summary={summary({
          rollingSevenDayStandardDrinks: 7.6,
          earliestRecordedConsumptionDate: '2026-08-27',
          recordedHistorySpanDays: 7,
          recordedHistorySpanStatus: 'seven-days-or-more',
        })}
        guidelines={ALCOHOL_GUIDELINES_RESPONSE}
        guidelineStatus="loaded"
        onRetryGuidelines={() => undefined}
      />,
    )

    expect(
      screen.getByText('Last 7 local calendar days'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(hasExactText('7.6 / 10 standard drinks')),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Based on drinks recorded on this device.'),
    ).toBeInTheDocument()
  })

  it('uses the unrounded aggregate for status even when display rounds to 4.0', () => {
    render(
      <AlcoholConsumptionSummary
        summary={summary({ dailyStandardDrinks: 4.04 })}
        guidelines={ALCOHOL_GUIDELINES_RESPONSE}
        guidelineStatus="loaded"
        onRetryGuidelines={() => undefined}
      />,
    )

    expect(
      screen.getByText(hasExactText('4.0 / 4 standard drinks')),
    ).toBeInTheDocument()
    expect(screen.getByText('Above the guideline')).toBeInTheDocument()
    expect(screen.getByText(/uses the unrounded total/i)).toBeInTheDocument()
  })

  it('shows local totals while guideline reference data loads', () => {
    render(
      <AlcoholConsumptionSummary
        summary={summary()}
        guidelines={null}
        guidelineStatus="loading"
        onRetryGuidelines={() => undefined}
      />,
    )

    expect(
      screen.getByText(hasExactText('1.5 standard drinks recorded')),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Loading Australian guideline comparisons/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/seven-day guideline comparison is not yet available/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/1\.5 \/ 4/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\/ 10 standard drinks/)).not.toBeInTheDocument()
  })

  it('retains local totals and retries after guideline failure', async () => {
    const onRetry = vi.fn()
    const user = userEvent.setup()
    render(
      <AlcoholConsumptionSummary
        summary={summary()}
        guidelines={null}
        guidelineStatus="failed"
        onRetryGuidelines={onRetry}
      />,
    )

    expect(
      screen.getByText(hasExactText('1.5 standard drinks recorded')),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/guideline values are temporarily unavailable/i),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Retry guideline comparison' }),
    )
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('does not render the pending US2.3 explanation controls', () => {
    render(
      <AlcoholConsumptionSummary
        summary={summary()}
        guidelines={ALCOHOL_GUIDELINES_RESPONSE}
        guidelineStatus="loaded"
        onRetryGuidelines={() => undefined}
      />,
    )

    expect(
      screen.queryByRole('link', { name: /What is a standard drink/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /About the Australian guidelines/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /Why does age matter/i }),
    ).not.toBeInTheDocument()
  })
})
