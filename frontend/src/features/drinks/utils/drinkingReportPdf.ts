/**
 * Browser-only export of the already computed report, with no storage/network
 * access. The small PDF 1.4 writer uses standard Helvetica and vector bars;
 * only English labels, ISO dates and numbers enter it (no arbitrary drink names).
 * Keep full precision for calculations; round only the displayed report values.
 */
export interface DrinkingReportPdfData {
  start: string; end: string; generated: string
  recordedDays: number; total: number; avgPerWeek: number
  avgDrinkingDaysPerWeek: number; avgPerDrinkingDay: number; highestDay: number
  daysAbove: number | null; weeksAbove: number | null
  dailyGuideline: number | null; weeklyGuideline: number | null
  weeks: { label: string; total: number }[]
  dailyTotals: { date: string; total: number }[]
}

// Literal-string escaping prevents report text from becoming PDF operators.
// The document intentionally uses ASCII English dates/labels and standard fonts.
function literal(value: string): string {
  return value.replace(/[^ -~]/g, '-').replace(/[\\()]/g, '\\$&')
}

function decimal(value: number): string {
  if (!Number.isFinite(value) || value < 0) throw new Error('Invalid report value.')
  return value.toFixed(1)
}

export function createDrinkingReportPdf(report: DrinkingReportPdfData): Uint8Array {
  if (report.weeks.length !== 4 || report.dailyTotals.length > 28 ||
      ![report.start, report.end, report.generated, ...report.dailyTotals.map(day => day.date)]
        .every(date => /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date))) {
    throw new Error('Invalid four-week report.')
  }
  const pages: string[] = []
  let commands: string[] = []
  const text = (x: number, y: number, value: string, size = 11, bold = false) => {
    commands.push('0.12 0.16 0.22 rg', `BT /F${bold ? 2 : 1} ${size} Tf 1 0 0 1 ${x} ${842 - y} Tm (${literal(value)}) Tj ET`)
  }
  const rect = (x: number, y: number, width: number, height: number, colour: string) => {
    commands.push(`${colour} rg ${x} ${842 - y - height} ${width} ${height} re f`)
  }
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    commands.push(`0.8 0.84 0.9 RG 0.5 w ${x1} ${842 - y1} m ${x2} ${842 - y2} l S`)
  const header = (title: string) => {
    rect(0, 0, 595, 9, '0.09 0.34 0.77')
    text(44, 49, 'SipAware Drinking Report', 22, true)
    text(44, 76, title, 13, true)
    text(44, 98, `Reporting period: ${report.start} to ${report.end}`)
    text(44, 116, `Generated: ${report.generated}   |   Recorded drinking days: ${report.recordedDays}`)
    line(44, 130, 551, 130)
  }
  const footer = (page: number) => {
    line(44, 735, 551, 735)
    text(44, 755, 'Based only on alcohol consumption recorded by the user in SipAware.', 9)
    text(44, 771, 'Missing records do not mean no alcohol was consumed. Not a medical diagnosis.', 9)
    text(44, 792, 'For discussion with your GP or another healthcare professional.', 9)
    text(494, 814, `Page ${page} of 2`, 9)
    pages.push(commands.join('\n')); commands = []
  }

  header('Four-week overview')
  const metrics: [string, number][] = [
    ['Average recorded standard drinks / week', report.avgPerWeek],
    ['Average recorded drinking days / week', report.avgDrinkingDaysPerWeek],
    ['Average standard drinks / recorded drinking day', report.avgPerDrinkingDay],
    ['Highest recorded daily total', report.highestDay],
    ['Total recorded standard drinks', report.total],
  ]
  metrics.forEach(([label, value], index) => {
    const y = 161 + index * 31
    if (index % 2 === 0) rect(44, y - 17, 507, 29, '0.95 0.97 1')
    text(54, y, label); text(491, y, decimal(value), 12, true)
  })
  text(44, 343, 'Guideline-related summary', 14, true)
  const limit = (value: number | null) => value === null ? 'unavailable' : decimal(value)
  text(44, 368, `Recorded days above ${limit(report.dailyGuideline)} standard drinks: ${report.daysAbove ?? 'Unavailable'}`)
  text(44, 390, `Recorded weeks above ${limit(report.weeklyGuideline)} standard drinks: ${report.weeksAbove ?? 'Unavailable'} of 4`)
  text(44, 431, 'Weekly recorded standard drinks', 14, true)

  // Fixed 4-week vectors and a reference line use the same unrounded totals as
  // the screen. Empty buckets mean no recorded amount, never alcohol-free days.
  const max = Math.max(report.weeklyGuideline ?? 0, ...report.weeks.map(week => week.total), 1) * 1.2
  const baseY = 650, height = 170
  line(60, baseY, 535, baseY)
  report.weeks.forEach((week, index) => {
    const value = decimal(week.total), barHeight = week.total / max * height
    const x = 89 + index * 115
    rect(x, baseY - barHeight, 58, barHeight, '0.1 0.36 0.8')
    text(x + 8, baseY - barHeight - 12, value, 11, true)
    text(x + 6, baseY + 22, `Week ${index + 1}`, 10)
  })
  if (report.weeklyGuideline !== null) {
    const y = baseY - report.weeklyGuideline / max * height
    commands.push(`0.76 0.4 0 RG 1 w [4 3] 0 d 60 ${842 - y} m 535 ${842 - y} l S [] 0 d`)
    text(60, 460, `${decimal(report.weeklyGuideline)} standard drinks / week guideline reference`, 10)
  } else text(60, 460, 'Guideline reference unavailable; recorded totals remain available.', 10)
  footer(1)

  header('Recorded drinking history')
  text(44, 156, 'Consumption date', 11, true)
  text(412, 156, 'Standard drinks', 11, true)
  if (report.dailyTotals.length === 0) text(44, 185, 'No drinking records in this reporting period.')
  report.dailyTotals.forEach((day, index) => {
    const y = 182 + index * 18
    if (index % 2 === 0) rect(44, y - 13, 507, 18, '0.95 0.97 1')
    text(54, y, day.date, 10)
    text(450, y, decimal(day.total), 10)
  })
  footer(2)

  // PDF cross-reference offsets are byte positions. Everything serialized here
  // is ASCII, so string lengths equal UTF-8 byte lengths deterministically.
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [5 0 R 7 0 R] /Count 2 >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ]
  pages.forEach((content, index) => {
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + index * 2} 0 R >>`)
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
  })
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const crossReference = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  offsets.slice(1).forEach(offset => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n` })
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${crossReference}\n%%EOF\n`
  return new TextEncoder().encode(pdf)
}

/** Downloads only after an explicit click; no server receives the report data. */
export function downloadDrinkingReportPdf(report: DrinkingReportPdfData): void {
  const bytes = createDrinkingReportPdf(report)
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `SipAware-report-${report.start}-to-${report.end}.pdf`
  document.body.append(link)
  try { link.click() } finally {
    link.remove()
    // Allow browsers time to begin reading the object URL before releasing it.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
