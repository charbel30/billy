/** The receipt curl is optically balanced independently of the rounded p tail.
 * The slit still links the receipt to the final o. Keep the approved lettering
 * intact when refining the symbol; visual harmony does not require identical cuts.
 */
const pTail = 'M0 0C0 4 -2 8 -8 11C-20 16 -16 34 -3 31C12 28 21 16 21 0C21 -6 0 -6 0 0Z'
const slit = 'M3 6C10 6 17 4 21 1C24 -1.2 27 3 24 5.5C18 10 10 12 3 12C-1 12 -1 6 3 6Z'

export const brand = {
  name: 'Spolio',
  gold: '#F7C928',
  ink: '#202820',
  green: '#285647',
  paper: '#F8F7F3',
  markTransform: 'rotate(-14 32 32)',
  pTail,
  slit,
  slitInReceipt: 'translate(21 15) scale(.85)',
  pTailTransform: 'translate(62 100)',
  slitInO: 'translate(305 55) rotate(-25) scale(.98)',
  oGapStrokeWidth: 2,
  receipt: 'M20 7H44Q50 7 50 13V34C41 34 36 39 32 45C28 51 24 57 19 57C15 57 13 54 13 49V14Q13 7 20 7Z M25 59C36 57 40 48 44 42C47 38 51 36 55 37C61 39 59 46 55 51C48 58 36 61 25 59Z',
  wordmarkViewBox: '0 0 335 132',
  wordmark: [
    // A soft s with open, rounded terminals.
    'M51 43C43 38 35 36 26 36C10 36 1 44 1 56C1 68 10 73 24 77L33 80C38 82 38 86 32 87C26 88 20 86 13 82C5 78 -2 90 5 97C12 103 23 106 33 105C50 104 59 96 59 84C59 72 49 67 36 63L25 60C20 58 21 54 27 54C32 54 37 56 42 58C52 62 59 49 51 43Z',
    // The p bowl and stem overlap the rounded tail, rendered separately.
    'M130 71A34 34 0 1 1 62 71A34 34 0 1 1 130 71Z M109 71A13 13 0 1 1 83 71A13 13 0 1 1 109 71Z',
    'M62 71H83V100H62Z',
    'M202 71A34 34 0 1 1 134 71A34 34 0 1 1 202 71Z M181 71A13 13 0 1 1 155 71A13 13 0 1 1 181 71Z',
    'M219.5 10Q230 10 230 20.5V94.5Q230 105 219.5 105Q209 105 209 94.5V20.5Q209 10 219.5 10Z',
    'M260 21A11 11 0 1 1 238 21A11 11 0 1 1 260 21Z M249 37Q259.5 37 259.5 47.5V94.5Q259.5 105 249 105Q238.5 105 238.5 94.5V47.5Q238.5 37 249 37Z',
    // A round o; the shared slit removes its opening through a mask.
    'M335 71A34 34 0 1 1 267 71A34 34 0 1 1 335 71Z M314 71A13 13 0 1 1 288 71A13 13 0 1 1 314 71Z',
  ],
} as const
