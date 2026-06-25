export const RECEIPT_EXTRACTION_PROMPT = `You read a restaurant or store receipt (Lebanon — English/French/Arabic, LBP and/or USD).
Respond with a SINGLE JSON object and nothing else — no markdown, no code fences, no commentary.

JSON shape (use exactly these keys):
{
  "merchant": string,
  "branch": string,
  "datetime": string,            // ISO 8601 if printed, else ""
  "currency_primary": string,    // currency the item prices are printed in: "USD" (e.g. 17.00) or "LBP" (e.g. 1700000)
  "line_items": [
    { "name": string, "qty": number, "unit_price": number, "line_total": number, "confidence": number }
  ],
  "service_charge": number,
  "tax": number,
  "printed_total_lbp": number | null,
  "printed_total_usd": number | null
}

Rules:
- Use printed_total_lbp / printed_total_usd as a constraint. If a quantity is illegible or occluded, infer it from line_total and the totals, and LOWER that item's confidence (0..1).
- NEVER invent or "correct" a price that is legible. If unsure, return it with low confidence — do not silently change it.
- Numbers are plain integers/decimals: no thousands separators, no currency symbols. Report every amount exactly as printed in currency_primary; never convert between LBP and USD.
- service_charge and tax: 0 if not printed.
- If only one currency total is printed, set the other to null.
- confidence is your certainty per line item (1 = fully legible).`
