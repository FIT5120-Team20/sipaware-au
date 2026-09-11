/**
 * Port of RecordPage.tsx at f5711b15: search/actions, category rail, card grid
 * and original SVG paths. Utility classes are translated to scoped plain CSS.
 * Catalog categories and My Drinks have separate provenance. DS catalog data
 * comes from the public read-only API. Personal templates and prototype samples
 * never fill catalog results. SavedDrink cards render only under My Drinks.
 */
import { useState, type ReactNode } from 'react'
import { CatalogResults } from './CatalogResults'
import type { CatalogCategory, CatalogProduct } from '../catalog/catalogApi'
import { ReferenceDialog } from './ReferenceDialog'
import type { SavedDrink } from '../types/savedDrink'
import type { DrinkType } from '../types/drinkingRecord'
function IcoBeer() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 4h11l1.5 14H3.5L5 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M17.5 8H20a2 2 0 0 1 0 4h-2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M8 4V2M12 4V2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
}
function IcoWine() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M8 3h8L14 12a2 2 0 0 1-4 0L8 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M12 14v7M8 21h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
}
function IcoSpirits() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M9 2h6v4l2 4v10a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V10l2-4V2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M7 14h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
}
function IcoCider() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 3C9 3 7 5 7 8s2 5 5 5 5-2 5-5-2-5-5-5Z" stroke="currentColor" strokeWidth="1.8" /><path d="M12 13v8M9 21h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M12 3s0-2 2-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
}
function IcoRTD() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="7" y="2" width="10" height="20" rx="2" stroke="currentColor" strokeWidth="1.8" /><path d="M10 6h4M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M9 10h6v4H9z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
}
function IcoOther() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 3h12L16.5 19h-9L6 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M9 19h6M12 14v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
}

function IcoSearch() {
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="8" cy="8" r="5.5" stroke="#647280" strokeWidth="1.5" /><path d="M12 12L16 16" stroke="#647280" strokeWidth="1.5" strokeLinecap="round" /></svg>
}
function IcoBarcode() {
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 4v2M2 12v2M16 4v2M16 12v2" stroke="#1A5FCC" strokeWidth="1.5" strokeLinecap="round" /><path d="M2 4h2M14 4h2M2 14h2M14 14h2" stroke="#1A5FCC" strokeWidth="1.5" strokeLinecap="round" /><path d="M5 5v8M7.5 5v8M10 5v8M12.5 5v8" stroke="#1A5FCC" strokeWidth="1.2" strokeLinecap="round" /></svg>
}
function IcoPlus() {
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 4v10M4 9h10" stroke="#1A5FCC" strokeWidth="1.5" strokeLinecap="round" /></svg>
}
export function IcoChevron() {
  return <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M1 1l5 5-5 5" stroke="#8A8682" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
function IcoStar() {
  return <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1l1.6 4H13L9.5 7.8 10.8 12 7 9.5 3.2 12l1.3-4.2L1 5h4.4L7 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
}
function HelpIcon() {
  return <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="#4A5260" strokeWidth="1.6" /><path d="M7.8 7.2a2.35 2.35 0 0 1 4.55.8c0 1.7-2.35 2-2.35 3.5" stroke="#4A5260" strokeWidth="1.6" strokeLinecap="round" /><circle cx="10" cy="14.6" r="0.9" fill="#4A5260" /></svg>
}


const styles = {
  beer: { bg: '#FEF3C7', color: '#B45309', icon: <IcoBeer /> },
  wine: { bg: '#FFE4E6', color: '#BE123C', icon: <IcoWine /> },
  spirits: { bg: '#DDEEFF', color: '#1B63D4', icon: <IcoSpirits /> },
  cider: { bg: '#DCFCE7', color: '#15803D', icon: <IcoCider /> },
  'rtd-premixed': { bg: '#ECEAFF', color: '#5B52DC', icon: <IcoRTD /> },
  other: { bg: '#F3F4F6', color: '#4A5260', icon: <IcoOther /> },
}
export function DrinkThumb({ type }: { type: DrinkType }) {
  const style = styles[type === 'cocktail' || type === 'liqueur' ? 'other' : type]
  return <span className="prototype-drink-thumb" aria-hidden="true" style={{ background: style.bg, color: style.color }}>{style.icon}</span>
}
const categories = ['My Drinks', 'All', 'Beer', 'Wine', 'Spirits', 'Cider', 'RTD', 'Other'] as const
export function ReferenceRecordBrowser({ savedDrinks, onScan, onManual, onProduct, children }: {
  savedDrinks: readonly SavedDrink[]
  onScan: () => void
  onManual: () => void
  onProduct: (product: CatalogProduct) => void
  children: (drinks: readonly SavedDrink[]) => ReactNode
}) {
  const [category, setCategory] = useState<string>('All')
  const [query, setQuery] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const isMyDrinks = category === 'My Drinks'
  const filtered = isMyDrinks ? savedDrinks.filter(drink =>
    drink.drinkName.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) : []
  return <div className="prototype-record-browser">
    <div className="prototype-record-top">
      <h1>Record a Drink</h1>
      <button type="button" className="prototype-help" onClick={() => setShowHelp(!showHelp)} aria-label="How to record a drink" aria-expanded={showHelp}><HelpIcon /></button>
    </div>
    {showHelp && <ReferenceDialog title="How to record a drink" onClose={() => setShowHelp(false)}>
      <p>All and the drink categories are for the public product catalog. My Drinks shows only drinks you choose to save on this device. Scan Barcode reads a barcode locally with your camera or a photo. Choose a catalog drink or barcode match to review its details, then enter how much you drank. Use Record Manually if you cannot find your drink.</p>
      <p>Save a drink to My Drinks for quicker recording next time. View drinking records in Trends → History. Your saved drinks and drinking records stay in this browser on this device.</p>
      <button type="button" className="primary-button" onClick={() => setShowHelp(false)}>Got it</button>
    </ReferenceDialog>}
    <div className="prototype-record-controls">
      <div className="prototype-record-search"><IcoSearch /><input type="search" aria-label="Search for a drink" placeholder="Search for a drink..." value={query} maxLength={200} onChange={e => setQuery(e.target.value)} />{query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}>×</button>}</div>
      <div className="prototype-record-actions">
        <button type="button" onClick={onScan}><IcoBarcode /><span>Scan Barcode</span></button>
        <button type="button" onClick={onManual}><IcoPlus /><span>Record Manually</span></button>
      </div>
    </div>
    <div className="prototype-record-workspace">
      <nav className="prototype-category-rail" aria-label="Drink categories">
        {categories.map((item, index) => <div key={item}>
          <button type="button" aria-pressed={category === item} onClick={() => setCategory(item)}><span>{item}</span></button>
          {index === 0 && <hr />}
        </div>)}
      </nav>
      <div className="prototype-record-results">
        {!isMyDrinks ? <CatalogResults key={`${category}:${query.trim()}`} category={category.toLowerCase() as CatalogCategory} query={query.trim()} onSelect={onProduct} /> : <>
        <div className="prototype-results-header"><h2>My Drinks</h2><span>{filtered.length} saved {filtered.length === 1 ? 'drink' : 'drinks'}</span></div>
        {filtered.length ? children(filtered) : <div className="prototype-empty">
          <span className="prototype-empty-icon" aria-hidden="true"><IcoStar /></span>
          <h3>{query.trim() ? 'No saved drinks match your search' : 'No saved drinks yet'}</h3>
          <p>{query.trim() ? 'Try another name or clear your search.' : 'Select Save this drink to My Drinks when recording to keep its details here for next time.'}</p>
        </div>}</>}
      </div>
    </div>
  </div>
}

export function IcoCalendar() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2.5" y="3.5" width="15" height="14" rx="2" stroke="#1A5FCC" strokeWidth="1.5" />
      <path d="M2.5 8h15" stroke="#1A5FCC" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6.5 2v3M13.5 2v3" stroke="#1A5FCC" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function IcoClock() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7.5" stroke="#1A5FCC" strokeWidth="1.5" />
      <path d="M10 6v4l2.5 2.5" stroke="#1A5FCC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function MinusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M4 10h12" stroke="#1A5FCC" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 4v12M4 10h12" stroke="#1A5FCC" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

