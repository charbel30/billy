import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { RiArrowLeftDownLine, RiCheckLine } from '@remixicon/react'
import { AnimatedAmount } from '~/components/ui/animated-amount'
import { BrandSymbol } from '~/components/shared/Brand'
import { playgroundCopy } from '../content'

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
      <div className="receipt-sticker" aria-hidden="true"><BrandSymbol /><span>Dollars & lira</span></div>
      <div className="receipt-paper">
        <div className="receipt-heading">
          <span className="receipt-overline">{playgroundCopy.place}</span>
          <h2>{playgroundCopy.venue}</h2>
        </div>

        <div className="receipt-toolbar">
          <span>{playgroundCopy.prompt}</span>
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
            <span>{playgroundCopy.yourShare}</span>
            <small>{selected.length === 0 ? playgroundCopy.emptyShare : playgroundCopy.pickedShare}</small>
          </div>
          <div className="receipt-total-values">
            <strong className="receipt-total-number">
              <AnimatedAmount
                key={currency}
                value={currency === 'USD' ? total / 100 : Math.round(total / 100 * EXAMPLE_RATE)}
                format={(n) => currency === 'USD'
                  ? `$${n.toFixed(2)}`
                  : `${Math.round(n).toLocaleString('en-US')} LL`}
              />
            </strong>
            <span className="receipt-total-converted">{currency === 'USD'
              ? `${Math.round(total / 100 * EXAMPLE_RATE).toLocaleString('en-US')} LL`
              : `$${(total / 100).toFixed(2)}`}</span>
          </div>
        </div>
        <div className="receipt-pass">
          <span className="receipt-pass-qr" aria-hidden="true">
            <QRCodeSVG value={playgroundCopy.demoUrl} size={44} marginSize={0} />
          </span>
          <p>{playgroundCopy.share}</p>
        </div>
        <p className="receipt-example-rate">$1 = 89,500 LL · venue rate</p>
      </div>
      <p className="receipt-invitation"><RiArrowLeftDownLine size={24} aria-hidden="true" /> {playgroundCopy.invitation}</p>
    </div>
  )
}
