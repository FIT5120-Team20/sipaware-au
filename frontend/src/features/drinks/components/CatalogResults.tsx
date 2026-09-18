/** Prototype cards backed by public products; category/query changes discard stale requests. */
import { useEffect, useState } from 'react'
import { getCachedCatalog, loadCatalog, type CatalogCategory, type CatalogPage, type CatalogProduct } from '../catalog/catalogApi'
import { getDrinkTypeLabel } from '../config/drinkTypes'
import { DrinkThumb, IcoChevron } from './ReferenceRecordBrowser'

export function CatalogResults({ category, query, onSelect }: {
  category: CatalogCategory; query: string; onSelect: (product: CatalogProduct) => void
}) {
  const [offset, setOffset] = useState(0)
  const [attempt, setAttempt] = useState(0)
    const [result, setResult] = useState<{
    offset: number
    attempt: number
    page?: CatalogPage
  }>(() => {
    const cached = getCachedCatalog(category, query, 0)
    return cached
      ? { offset: 0, attempt: 0, page: cached }
      : { offset: -1, attempt: -1 }
  })
  const ready = result.offset === offset && result.attempt === attempt
  const page = ready ? result.page : undefined

  useEffect(() => {
    const owner = new AbortController()
    const timer = setTimeout(() => {
      loadCatalog(category, query, offset, owner.signal).then(
        value => { if (!owner.signal.aborted) setResult({ offset, attempt, page: value }) },
        () => { if (!owner.signal.aborted) setResult({ offset, attempt }) },
      )
    }, query ? 250 : 0)

    return () => { clearTimeout(timer); owner.abort() }
  }, [category, query, offset, attempt])
  const heading = category === 'all' ? 'All Drinks' : category === 'rtd' ? 'RTD' : category
  const sources = page ? [...new Map(page.products.map(p => [p.sourceUrl, p.sourceName])).entries()] : []
  return <>
    <div className="prototype-results-header"><h2>{heading}</h2><span role="status">{page ? `${page.total} ${page.total === 1 ? 'drink' : 'drinks'}` : ready ? 'Catalog unavailable' : 'Loading drinks…'}</span></div>
    {!ready ? <div className="prototype-empty" aria-busy="true"><p>Loading the product catalog…</p></div> : !page ?
      <div className="prototype-empty" role="alert"><h3>Product catalog temporarily unavailable</h3>
        <p>Please try again, choose My Drinks, or record manually.</p>
        <button type="button" className="secondary-button" onClick={() => setAttempt(a => a + 1)}>Retry catalog</button></div> : <>
        {page.products.length ? <ul className="saved-drinks-list" aria-label="Catalog drinks">
          {page.products.map(product => <li key={product.productId}><article className="saved-drink-item">
            <button type="button" className="saved-drink-button" onClick={() => onSelect(product)}>
              <DrinkThumb type={product.drinkType} /><span className="prototype-card-copy">
                <strong title={product.drinkName}>{product.drinkName}</strong>
                <span className="prototype-card-brand">{product.brandName?.trim() ? `Brand: ${product.brandName}` : 'Brand not provided'}</span>
                <span>{getDrinkTypeLabel(product.drinkType)} · {product.abvPercent}% ABV · {product.volumeMl} mL</span>
              </span><IcoChevron />
            </button>
          </article></li>)}
        </ul> : <div className="prototype-empty"><h3>{query ? 'No drinks match your search' : 'No drinks in this category yet'}</h3>
          <p>Try another name or category, or record your drink manually.</p></div>}
        {(page.total > 24 || offset > 0) && <nav className="prototype-catalog-pagination" aria-label="Catalog pages">
          <button type="button" className="secondary-button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 24))}>Previous</button>
          <span>{page.products.length ? `${offset + 1}–${offset + page.products.length}` : '0'} of {page.total}</span>
          <button type="button" className="secondary-button" disabled={offset + 24 >= page.total} onClick={() => setOffset(offset + 24)}>Next</button>
        </nav>}
        {!!sources.length && <p className="prototype-catalog-status">Imported product data: {sources.map(([url, name], index) => <span key={url}>{index > 0 && ' · '}<a href={url} target="_blank" rel="noopener noreferrer">{name}</a></span>)}. Volumes are per container. Check the label before recording.</p>}
      </>}
  </>
}
