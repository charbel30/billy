import { useState } from 'react'
import { RiArrowLeftDownLine, RiCheckLine } from '@remixicon/react'

const ITEMS = [
  { id: 'taouk', name: 'Chicken taouk', price: 900, emoji: '🥙' },
  { id: 'fries', name: 'Fries for the table', price: 600, emoji: '🍟', shared: true },
  { id: 'lemonade', name: 'Mint lemonade', price: 400, emoji: '🍋' },
]
const EXAMPLE_RATE = 89500

export function ReceiptPlayground() {
  const [selected, setSelected] = useState(['taouk', 'fries'])
  const [currency, setCurrency] = useState<'USD' | 'LBP'>('USD')
  const total = ITEMS.reduce((sum, item) =>
    sum + (selected.includes(item.id) ? item.price / (item.shared ? 3 : 1) : 0), 0)

  function formatAmount(cents: number) {
    return currency === 'USD'
      ? `$${(cents / 100).toFixed(2)}`
      : `${Math.round(cents / 100 * EXAMPLE_RATE).toLocaleString('en-US')} LL`
  }

  function toggleItem(id: string) {
    setSelected((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id])
  }

  return (
    <div className="receipt-playground landing-enter">
      <div className="receipt-placemat" aria-hidden="true" />
      <div className="receipt-sticker" aria-hidden="true">the only thing<br />you need to split.</div>
      <div className="receipt-paper">
        <div className="receipt-heading">
          <span className="receipt-overline">SPOLIO’S LITTLE DEMO</span>
          <h2>A good night out.</h2>
          <p>3 friends · 1 bill · zero mental math</p>
        </div>

        <div className="receipt-toolbar">
          <span>What did you have?</span>
          <div className="receipt-currencies" role="group" aria-label="Demo currency">
            {(['USD', 'LBP'] as const).map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={currency === value}
                onClick={() => setCurrency(value)}
              >{value === 'USD' ? 'USD' : 'LL'}</button>
            ))}
          </div>
        </div>

        <div className="receipt-items" role="group" aria-label="Choose your demo items">
          {ITEMS.map((item) => {
            const isSelected = selected.includes(item.id)
            return (
              <button
                key={item.id}
                type="button"
                className="receipt-item"
                aria-pressed={isSelected}
                onClick={() => toggleItem(item.id)}
              >
                <span className="receipt-checkbox" aria-hidden="true">
                  <RiCheckLine size={14} />
                </span>
                <span className="receipt-food" aria-hidden="true">{item.emoji}</span>
                <span className="receipt-item-name">
                  {item.name}
                  {item.shared && <small>Split 3 ways · your third</small>}
                </span>
                <span className="receipt-price">{formatAmount(item.price / (item.shared ? 3 : 1))}</span>
              </button>
            )
          })}
        </div>

        <div className="receipt-total" role="status" aria-live="polite" aria-atomic="true">
          <div>
            <span>Your share</span>
            <small>{selected.length === 0 ? 'Pick something above' : 'Just what you picked.'}</small>
          </div>
          <strong>{formatAmount(total)}</strong>
        </div>
        <div className="receipt-signoff">
          <span className="receipt-diners" aria-hidden="true"><i>Y</i><i>N</i><i>R</i></span>
          <span>A table for you, Nour & Rami.</span>
        </div>
        <p className="receipt-example-rate">Example bill · $1 = 89,500 LL</p>
      </div>
      <p className="receipt-invitation"><RiArrowLeftDownLine size={24} aria-hidden="true" /> Go on, tap your order.</p>
    </div>
  )
}
