/**
 * ADAPT: pinned LearnPage.TopicDetail uses a reading column, hero, numbered
 * points, source panel and resource rows. Only presentation is borrowed:
 * information and source links remain API-backed. Verification metadata stays
 * in the data contract; the reading view deliberately omits its date.
 * Real anchors replace the prototype's inert resource buttons.
 */
import type { AlcoholInformationTopicDto } from '../types/alcoholInformation'
import type { AlcoholInformationTopicCode } from '../types/alcoholGuideline'
import '../referenceArticle.css'
function ExternalLink() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M5 2H2v10h10V9M8 2h4v4M12 2L6 8" stroke="#1A5FCC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Stethoscope() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M6 3H3C3 7.5 4.5 10.5 8 12" stroke="#1A5FCC" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 3h3C21 7.5 19.5 10.5 16 12" stroke="#1A5FCC" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 3v9" stroke="#1A5FCC" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 12a4 4 0 0 0 4 4 4 4 0 0 0 4-4" stroke="#1A5FCC" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16.5" cy="17.5" r="2.5" stroke="#1A5FCC" strokeWidth="2" />
    </svg>
  )
}

function InfoCircle() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7.5" stroke="#4A5260" strokeWidth="1.5" />
      <path d="M9 8v5" stroke="#4A5260" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="9" cy="5.5" r="0.75" fill="#4A5260" />
    </svg>
  )
}


const presentation: Record<AlcoholInformationTopicCode, { title: string; image: string; section: string }> = {
 STANDARD_DRINK: {title:'Standard Drinks',image:'home-standard.svg',section:'What you need to know about standard drinks'},
 ALCOHOL_GUIDELINES: {title:'Australian Alcohol Guidelines',image:'learn-guidelines.svg',section:'Understanding the Australian alcohol guidelines'},
 ALCOHOL_AGEING: {title:'Alcohol & Ageing',image:'home-ageing.svg',section:'Why can alcohol affect you differently as you age?'},
 ALCOHOL_DRIVING: {title:'Alcohol & Driving',image:'learn-driving.svg',section:'What you need to know about alcohol and driving'},
 ALCOHOL_MEDICINES: {title:'Alcohol & Medicines',image:'learn-medicines.svg',section:'Why extra care may be needed with medicines'},
 ALCOHOL_LEGAL: {title:'Alcohol & Legal Information',image:'home-know.svg',section:'What you need to know about alcohol laws'},
}
export function AlcoholInformationSection({ topic }: { topic: AlcoholInformationTopicDto }) {
 const view = presentation[topic.topicCode]
 const headingId = 'alcohol-information-heading-' + topic.topicCode
 const sources = [...new Map(topic.content.flatMap(content => content.sources).map(source => [source.url,source])).values()]
 const primary = sources.find(source => source.role === 'PRIMARY') ?? sources[0]
 return <section className="alcohol-information-section reference-topic-detail" id={topic.topicCode} aria-labelledby={headingId}>
  <header className="reference-topic-heading">
   <h2 id={headingId} tabIndex={-1} aria-label={topic.displayName}>{view.title}</h2>
   <p>{'Clear, trusted Australian information about ' + view.title.toLowerCase() + '.'}</p>
  </header>
  <img className="reference-topic-hero" src={'/reference-ui/' + view.image} alt={view.title} draggable={false} />
  <div className="reference-topic-key-info">
   <h3>{view.section}</h3>
   <div className="reference-topic-points">{topic.content.map((content,index) =>
    <article key={content.id} className="reference-topic-point">
     <span className="reference-topic-number" aria-hidden="true">{index + 1}</span>
     <div><h4>{content.title}</h4><p>{content.bodyText}</p>
     </div>
    </article>
   )}</div>
  </div>
  {primary && <aside className="reference-topic-source">
   <h3>Source</h3><strong>{primary.organisation}</strong><p>{primary.name}</p>
   <a href={primary.url} target="_blank" rel="noreferrer">View source <ExternalLink /></a>
  </aside>}
  <div className="reference-topic-more">
   <h3>Need more information?</h3>
   <p>Our website provides general information to help you better understand alcohol and your drinking.</p>
   <h4>Trusted Australian Resources</h4>
   <div className="reference-topic-resources">{sources.map(source =>
    <a key={source.url} href={source.url} target="_blank" rel="noreferrer" aria-label={source.name}>
     <span>{source.name}<small>{source.role === 'PRIMARY' ? 'Primary source' : 'Supporting source'} · {source.organisation}</small></span><ExternalLink />
    </a>
   )}</div>
   <aside className="reference-topic-advice"><Stethoscope /><div><strong>Advice about your health</strong>
    <p>For advice specific to your health, medical conditions or medicines, speak with your GP, pharmacist or another qualified health professional.</p></div>
   </aside>
   <aside className="reference-topic-disclaimer"><InfoCircle /><p>This information is general in nature and does not replace personalised medical advice.</p></aside>
  </div>
 </section>
}
