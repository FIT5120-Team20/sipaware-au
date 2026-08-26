import { BackendStatus } from '../components/BackendStatus'

export function BootstrapPage() {
  return (
    <main className="bootstrap-page">
      <section className="bootstrap-card" aria-labelledby="page-title">
        <h1 id="page-title">SipAware AU</h1>
        <p>Alcohol Consumption and Preventive Health</p>
        <BackendStatus />
      </section>
    </main>
  )
}
