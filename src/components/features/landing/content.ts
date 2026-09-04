export const landingSeo = {
  title: 'Spolio — Split any bill in LBP & USD',
  description:
    'Scan a Lebanese receipt, split it item-by-item, and share a live link on WhatsApp. Spolio reads both the LL and $ totals and uses the venue’s real rate. No install, no account.',
  keywords:
    'bill splitter, receipt scanner, split the bill, Lebanon, LBP, USD, lira rate, restaurant bill',
  image: '/og-image.png', // TODO: absolute URL once production domain is fixed
}

export const heroCopy = {
  badge: 'Built for Lebanon’s two-currency bills',
  headline: 'One receipt. Two currencies. Zero arguments.',
  subhead:
    'Snap the receipt, split it item-by-item, and share a live link in the group chat. Spolio reads both the LL and $ totals and does the math at the rate the venue actually used — no install, no account.',
  primaryCta: 'Scan a receipt', // → /scan
  secondaryCta: 'Try a sample bill', // → demo mutation → /review/$billId
}

export const howItWorksCopy = {
  title: 'From receipt to "you owe me" in three steps',
  steps: [
    {
      title: 'Scan',
      body: 'Snap the check. Spolio reads every line item — and both totals.',
    },
    {
      title: 'Split',
      body: 'Share the link. Everyone claims their own items from their phone — nothing to install.',
    },
    {
      title: 'Settle',
      body: 'Live totals per person, in LBP and USD. The link stays up to date as people claim.',
    },
  ],
}

export const dualCurrencyCopy = {
  title: 'The venue’s real rate, not today’s guess',
  body:
    'Lebanese receipts print two totals — TOTAL LL and TOTAL $. Spolio derives the exact rate the venue used from those two numbers, so every share is right in both currencies. No "what’s the rate today?" debate.',
  receiptDemo: {
    lbpLabel: 'TOTAL LL',
    lbpValue: '4,475,000',
    usdLabel: 'TOTAL $',
    usdValue: '50.00',
    rateLabel: 'Rate Spolio derives',
    rateValue: '89,500 LL / $',
  },
}
