// Prompt = rules only. The output shape is enforced by RECEIPT_RESPONSE_SCHEMA
// via Gemini structured output (generationConfig.responseSchema) — Google's docs
// warn that also describing the schema in the prompt degrades output quality.
export const RECEIPT_EXTRACTION_PROMPT = `You read a restaurant or store receipt (Lebanon — English/French/Arabic, LBP and/or USD).
Extract it into the required JSON structure.

Rules:
- Use printed_total_lbp / printed_total_usd as a constraint. If a quantity is illegible or occluded, infer it from line_total and the totals, and LOWER that item's confidence (0..1).
- NEVER invent or "correct" a price that is legible. If unsure, return it with low confidence — do not silently change it.
- Numbers are plain integers/decimals: no thousands separators, no currency symbols. Report every amount exactly as printed in the receipt's primary currency; never convert between LBP and USD.
- Decimal points matter. USD amounts print with a decimal point ("77.00", "$77") and are almost always under 1,000 on a receipt — 77.00 is 77, never 7700. LBP amounts are large integers (tens of thousands and up), often printed with thousands separators to strip.
- Cross-check the totals: printed_total_lbp divided by printed_total_usd is an exchange rate in the tens of thousands (roughly 90,000). If your extracted totals imply a ratio near 9, 900, or 9,000,000, you misread a decimal point — re-read both totals.
- service_charge and tax: 0 if not printed.
- If only one currency total is printed, set the other to null.
- confidence is your certainty per line item (1 = fully legible).`

// Gemini structured-output schema (OpenAPI-style Schema object for the REST
// generateContent generationConfig.responseSchema field). Field descriptions
// carry the per-field guidance; the prompt above carries only behavioral rules.
export const RECEIPT_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    merchant: {
      type: 'STRING',
      description: 'Merchant / venue name as printed. "" if not printed.',
    },
    branch: {
      type: 'STRING',
      description: 'Branch or location line. "" if not printed.',
    },
    datetime: {
      type: 'STRING',
      description: 'Receipt date-time, ISO 8601 if printed, else "".',
    },
    currency_primary: {
      type: 'STRING',
      enum: ['USD', 'LBP'],
      description:
        'Currency the item prices are printed in: "USD" (e.g. 17.00) or "LBP" (e.g. 1700000).',
    },
    line_items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING', description: 'Item name as printed.' },
          qty: { type: 'NUMBER', description: 'Quantity (inferred if occluded).' },
          unit_price: {
            type: 'NUMBER',
            description: 'Price per unit in currency_primary, as printed.',
          },
          line_total: {
            type: 'NUMBER',
            description: 'Line total in currency_primary, as printed.',
          },
          confidence: {
            type: 'NUMBER',
            description: 'Certainty for this line, 0..1 (1 = fully legible).',
          },
        },
        required: ['name', 'qty', 'unit_price', 'line_total', 'confidence'],
        propertyOrdering: [
          'name',
          'qty',
          'unit_price',
          'line_total',
          'confidence',
        ],
      },
    },
    service_charge: {
      type: 'NUMBER',
      description: 'Service charge in currency_primary; 0 if not printed.',
    },
    tax: {
      type: 'NUMBER',
      description: 'Tax (VAT/TVA) in currency_primary; 0 if not printed.',
    },
    printed_total_lbp: {
      type: 'NUMBER',
      nullable: true,
      description:
        'Grand total in LBP exactly as printed (large integer), or null if no LBP total is printed.',
    },
    printed_total_usd: {
      type: 'NUMBER',
      nullable: true,
      description:
        'Grand total in USD exactly as printed (keep the decimal point: "77.00" is 77), or null if no USD total is printed.',
    },
  },
  required: [
    'merchant',
    'branch',
    'datetime',
    'currency_primary',
    'line_items',
    'service_charge',
    'tax',
    'printed_total_lbp',
    'printed_total_usd',
  ],
  propertyOrdering: [
    'merchant',
    'branch',
    'datetime',
    'currency_primary',
    'line_items',
    'service_charge',
    'tax',
    'printed_total_lbp',
    'printed_total_usd',
  ],
} as const
