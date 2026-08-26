import { getDrinkTypeLabel } from '../config/drinkTypes'
import type { DrinkingRecord } from '../types/drinkingRecord'
import { formatConsumedDateTime } from '../utils/formatConsumedDateTime'

interface RecentDrinkingRecordsProps {
  records: readonly DrinkingRecord[]
}

const MAX_RECENT_RECORDS = 3

function formatRecordedNumber(value: number): string {
  return String(value)
}

export function RecentDrinkingRecords({
  records,
}: RecentDrinkingRecordsProps) {
  const recentRecords = records.slice(-MAX_RECENT_RECORDS).reverse()

  return (
    <section className="recent-records-card" aria-labelledby="recent-records-title">
      <div className="section-heading">
        <p className="section-kicker">Saved on this device</p>
        <h2 id="recent-records-title">Recent records</h2>
        <p>This read-only list shows your three most recently saved entries.</p>
      </div>

      {recentRecords.length === 0 ? (
        <p className="empty-state">No drinks recorded on this device yet.</p>
      ) : (
        <ol className="recent-records-list">
          {recentRecords.map((record) => (
            <li key={record.id}>
              <article className="recent-record">
                <div className="recent-record__heading">
                  <h3>{record.drinkName}</h3>
                  <span>{getDrinkTypeLabel(record.drinkType)}</span>
                </div>

                <dl>
                  <div>
                    <dt>Serving volume</dt>
                    <dd>{formatRecordedNumber(record.servingVolumeMl)} mL</dd>
                  </div>
                  <div>
                    <dt>ABV</dt>
                    <dd>{formatRecordedNumber(record.abvPercent)}%</dd>
                  </div>
                  <div>
                    <dt>Servings consumed</dt>
                    <dd>{formatRecordedNumber(record.amountConsumed)}</dd>
                  </div>
                  <div>
                    <dt>Consumed</dt>
                    <dd>
                      <time dateTime={record.consumedAt}>
                        {formatConsumedDateTime(record)}
                      </time>
                    </dd>
                  </div>
                </dl>
              </article>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
