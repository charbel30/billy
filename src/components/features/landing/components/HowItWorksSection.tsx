import { howItWorksCopy } from '../content'

export function HowItWorksSection() {
  return (
    <section className="landing-how" aria-labelledby="how-title">
      <h2 id="how-title">{howItWorksCopy.title}</h2>
      <ol className="landing-steps">
        {howItWorksCopy.steps.map((step, i) => (
          <li key={step.title}>
            <span className="landing-step-number" aria-hidden="true">0{i + 1}</span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="landing-currency-note">
        <span className="landing-currency-symbol" aria-hidden="true">$ / LL</span>
        Your share in dollars and lira, at the rate on the receipt.
      </p>
    </section>
  )
}
