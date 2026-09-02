/**
 * Presents locally derived consumption totals against public Neon guidelines.
 *
 * The component receives already-derived personal values and never performs a
 * network request or persists calculation output.
 */
import type { AlcoholConsumptionSummary as ConsumptionSummary } from '../calculations/alcoholConsumptionSummary'
import { formatStandardDrinks } from '../calculations/standardDrinks'
import type {
  AlcoholGuidelineDto,
  AlcoholGuidelinesResponseDto,
  GuidelineLoadStatus,
} from '../types/alcoholGuideline'
import { AlcoholInformationTopicLink } from './AlcoholInformationTopicLink'
import '../alcoholConsumption.css'

interface AlcoholConsumptionSummaryProps {
  summary: ConsumptionSummary
  guidelines: AlcoholGuidelinesResponseDto | null
  guidelineStatus: GuidelineLoadStatus
  onRetryGuidelines: () => void
}

function getGuideline(
  guidelines: AlcoholGuidelinesResponseDto,
  type: AlcoholGuidelineDto['guidelineType'],
): AlcoholGuidelineDto {
  const guideline = guidelines.guidelines.find(
    (candidate) => candidate.guidelineType === type,
  )
  if (!guideline) {
    throw new Error(`Missing ${type} alcohol guideline.`)
  }
  return guideline
}

function formatThreshold(value: number): string {
  return String(value)
}

function guidelineStatusText(total: number, threshold: number): string {
  if (total > threshold) {
    return 'Above the guideline'
  }
  if (total < threshold) {
    return 'Below the guideline'
  }
  return 'At the guideline'
}

function GuidelineComparison({
  label,
  total,
  guideline,
  valueContext,
}: {
  label: string
  total: number
  guideline: AlcoholGuidelineDto
  valueContext?: string
}) {
  const isAbove = total > guideline.thresholdStandardDrinks

  return (
    <div
      className={`consumption-comparison consumption-comparison--${
        isAbove ? 'above' : 'not-above'
      }`}
    >
      <p className="consumption-comparison__label">{label}</p>
      <p className="consumption-comparison__value">
        <strong>{formatStandardDrinks(total)}</strong>
        {' / '}
        {formatThreshold(guideline.thresholdStandardDrinks)} standard drinks
        {valueContext && <> {valueContext}</>}
      </p>
      <p className="consumption-comparison__status">
        {guidelineStatusText(total, guideline.thresholdStandardDrinks)}
      </p>
    </div>
  )
}

export function AlcoholConsumptionSummary({
  summary,
  guidelines,
  guidelineStatus,
  onRetryGuidelines,
}: AlcoholConsumptionSummaryProps) {
  const hasRecordedHistory = summary.recordedHistorySpanStatus !== 'none'

  return (
    <section
      className="consumption-summary-card"
      aria-labelledby="consumption-summary-title"
    >
      <div className="section-heading consumption-summary-heading">
        <p className="section-kicker">Your consumption</p>
        <h2 id="consumption-summary-title">Standard drink summary</h2>
        <p>Based on drinks recorded on this device.</p>
      </div>

      {!hasRecordedHistory ? (
        <div className="consumption-history-message">
          <p>No current or past drinking history is available for feedback.</p>
          {summary.excludedFutureRecordCount > 0 && (
            <p>
              {summary.excludedFutureRecordCount}{' '}
              {summary.excludedFutureRecordCount === 1 ? 'record is' : 'records are'}
              {' excluded because '}
              {summary.excludedFutureRecordCount === 1 ? 'its date is' : 'their dates are'}
              {' in the future.'}
            </p>
          )}
        </div>
      ) : (
        <>
          {guidelineStatus === 'loaded' && guidelines ? (
            <div className="consumption-comparisons">
              <GuidelineComparison
                label="Today"
                total={summary.dailyStandardDrinks}
                guideline={getGuideline(guidelines, 'DAILY')}
                valueContext={
                  // No eligible record today is not confirmation of zero intake.
                  summary.dailyStandardDrinks === 0
                    ? 'recorded today'
                    : undefined
                }
              />

              {summary.recordedHistorySpanStatus ===
              'seven-days-or-more' ? (
                <GuidelineComparison
                  label="Last 7 local calendar days"
                  total={summary.rollingSevenDayStandardDrinks}
                  guideline={getGuideline(guidelines, 'WEEKLY')}
                />
              ) : (
                <div className="consumption-history-message">
                  <p>
                    <strong>
                      {formatStandardDrinks(
                        summary.rollingSevenDayStandardDrinks,
                      )}
                    </strong>{' '}
                    standard drinks recorded across{' '}
                    {summary.recordedHistorySpanDays}{' '}
                    {summary.recordedHistorySpanDays === 1 ? 'day' : 'days'}{' '}
                    of available history.
                  </p>
                  <p>
                    A seven-day guideline comparison will be available once
                    the recorded history span reaches seven local calendar
                    days. Missing records are not treated as zero consumption.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="consumption-comparisons">
              <div className="consumption-comparison">
                <p className="consumption-comparison__label">Today</p>
                <p className="consumption-comparison__value">
                  <strong>
                    {formatStandardDrinks(summary.dailyStandardDrinks)}
                  </strong>{' '}
                  standard drinks recorded
                </p>
              </div>
              <div className="consumption-history-message">
                {summary.recordedHistorySpanStatus ===
                'under-seven-days' ? (
                  <>
                    <p>
                      <strong>
                        {formatStandardDrinks(
                          summary.rollingSevenDayStandardDrinks,
                        )}
                      </strong>{' '}
                      standard drinks recorded across{' '}
                      {summary.recordedHistorySpanDays}{' '}
                      {summary.recordedHistorySpanDays === 1 ? 'day' : 'days'}{' '}
                      of available history.
                    </p>
                    <p>
                      A seven-day guideline comparison is not yet available.
                      Missing records are not treated as zero consumption.
                    </p>
                  </>
                ) : (
                  <p>
                    <strong>
                      {formatStandardDrinks(
                        summary.rollingSevenDayStandardDrinks,
                      )}
                    </strong>{' '}
                    standard drinks recorded in the last seven local calendar
                    days.
                  </p>
                )}
              </div>
            </div>
          )}

          {guidelineStatus === 'loading' && (
            <p className="guideline-load-message" role="status">
              Loading Australian guideline comparisons...
            </p>
          )}

          {guidelineStatus === 'failed' && (
            <div className="guideline-load-error" role="alert">
              <p>
                Australian guideline values are temporarily unavailable. Your
                recorded totals are still calculated locally.
              </p>
              <button
                className="secondary-button"
                type="button"
                onClick={onRetryGuidelines}
              >
                Retry guideline comparison
              </button>
            </div>
          )}

          {guidelineStatus === 'loaded' && guidelines && (
            <div className="guideline-context">
              <p>{getGuideline(guidelines, 'DAILY').guidelineText}</p>
              <p>
                Comparison status uses the unrounded total. These guidelines
                describe reducing alcohol-related risk; they are not a
                guarantee of safety or a medical diagnosis.
              </p>
              <p>
                Source:{' '}
                <a
                  href={getGuideline(guidelines, 'DAILY').source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {getGuideline(guidelines, 'DAILY').source.organisation}
                </a>
              </p>
            </div>
          )}
        </>
      )}

      <nav
        className='related-information'
        aria-label='Related alcohol information'
      >
        <h3>Learn more</h3>
        <ul>
          <li>
            <AlcoholInformationTopicLink topicCode='STANDARD_DRINK'>
              What is a standard drink?
            </AlcoholInformationTopicLink>
          </li>
          <li>
            <AlcoholInformationTopicLink topicCode='ALCOHOL_GUIDELINES'>
              About the Australian guidelines
            </AlcoholInformationTopicLink>
          </li>
          <li>
            <AlcoholInformationTopicLink topicCode='ALCOHOL_AGEING'>
              Why does age matter?
            </AlcoholInformationTopicLink>
          </li>
        </ul>
      </nav>
    </section>
  )
}
