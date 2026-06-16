import { v } from 'convex/values'
import { internalAction } from './_generated/server'
import { internal } from './_generated/api'
import { invariant } from './invariant'
import * as imageStore from './imageStore'
import type { ExtractedReceipt } from '../src/lib/types'

// Vision-LLM extraction (spec §4). Primary: Gemini (vision), called through the
// Cloudflare AI Gateway for caching/retries/cost analytics. The provider lives
// behind `callVisionModel` so it's swappable (OCR→text-LLM fallback, Qwen3-VL).
// Keys live in Convex env vars and never reach the browser.

// Structured-output config (responseSchema/responseFormat) varies across Gemini
// versions and is rejected by gemini-3.x on generateContent, so we instruct the
// shape in the prompt and parse the text. The reconcile checksum + fence-stripping
// below are the backstops.
const PROMPT = `You read a restaurant or store receipt (Lebanon — English/French/Arabic, LBP and/or USD).
Respond with a SINGLE JSON object and nothing else — no markdown, no code fences, no commentary.

JSON shape (use exactly these keys):
{
  "merchant": string,
  "branch": string,
  "datetime": string,            // ISO 8601 if printed, else ""
  "currency_primary": string,    // main currency, usually "LBP"
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
- Numbers are plain integers/decimals: no thousands separators, no currency symbols.
- service_charge and tax: 0 if not printed.
- If only one currency total is printed, set the other to null.
- confidence is your certainty per line item (1 = fully legible).`

/** Base64-encode bytes without Node Buffer (Convex default runtime). */
function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** The single swappable provider call: image -> structured receipt JSON. */
async function callVisionModel(
  base64: string,
  mimeType: string,
): Promise<ExtractedReceipt> {
  const accountId = process.env.CF_AIG_ACCOUNT_ID
  const gateway = process.env.CF_AIG_GATEWAY
  const model = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash'
  // Two valid auth setups:
  //  - BYOK: the Gemini key is stored in the AI Gateway. Send only the gateway
  //    token (CF_AIG_TOKEN); the gateway injects the provider key.
  //  - Key in Convex: send x-goog-api-key (GEMINI_API_KEY).
  const apiKey = process.env.GEMINI_API_KEY
  const gatewayToken = process.env.CF_AIG_TOKEN
  invariant(
    accountId && gateway,
    'Missing extraction env vars: set CF_AIG_ACCOUNT_ID and CF_AIG_GATEWAY',
  )
  invariant(
    apiKey || gatewayToken,
    'Set GEMINI_API_KEY (key in Convex) or CF_AIG_TOKEN (key stored in the AI Gateway)',
  )

  const endpoint = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gateway}/google-ai-studio/v1/models/${model}:generateContent`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'cf-aig-cache-ttl': '86400', // identical retries are served from cache
      // Provider key — omitted when the gateway holds it (BYOK).
      ...(apiKey ? { 'x-goog-api-key': apiKey } : {}),
      // Authenticated Gateway: authorize the request through the gateway itself.
      ...(gatewayToken
        ? { 'cf-aig-authorization': `Bearer ${gatewayToken}` }
        : {}),
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { inline_data: { mime_type: mimeType, data: base64 } },
            { text: PROMPT },
          ],
        },
      ],
    }),
  })

  if (!res.ok) {
    throw new Error(`Vision model error ${res.status}: ${await res.text()}`)
  }
  const json = await res.json()
  const raw: string | undefined =
    json?.candidates?.[0]?.content?.parts?.[0]?.text
  invariant(raw, 'no text in vision model response')
  // Defensive: strip ```json fences if the model wraps the JSON.
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  return JSON.parse(cleaned) as ExtractedReceipt
}

export const extractReceipt = internalAction({
  args: { billId: v.id('bills'), imageRef: v.string() },
  handler: async (ctx, { billId, imageRef }) => {
    const { bytes, mimeType } = await imageStore.readImage(ctx, imageRef)
    const parsed = await callVisionModel(toBase64(bytes), mimeType)
    await ctx.runMutation(internal.bills.applyExtraction, { billId, parsed })
    // delete-after-extract (spec §10); best-effort.
    try {
      await imageStore.deleteImage(ctx, imageRef)
    } catch {
      // already gone or not deletable — ignore
    }
  },
})
