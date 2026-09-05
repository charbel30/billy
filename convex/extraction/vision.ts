import type { ExtractedReceipt } from '../../src/lib/types'
import { invariant } from '../lib/invariant'
import { RECEIPT_EXTRACTION_PROMPT, RECEIPT_RESPONSE_SCHEMA } from './prompt'

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

/**
 * Models differ on absent-field encoding (3.5-flash emits "", flash-lite emits
 * null) and applyExtraction's validators accept undefined-not-null. Normalize
 * here so provider quirks never reach the mutation as a non-retryable
 * ArgumentValidationError.
 */
function normalizeExtracted(raw: ExtractedReceipt): ExtractedReceipt {
  const str = (val: unknown): string | undefined =>
    typeof val === 'string' && val !== '' ? val : undefined
  const num = (val: unknown, fallback: number): number =>
    typeof val === 'number' && Number.isFinite(val) ? val : fallback
  return {
    merchant: str(raw.merchant),
    branch: str(raw.branch),
    datetime: str(raw.datetime),
    currency_primary: str(raw.currency_primary) ?? 'LBP',
    line_items: (raw.line_items ?? []).map((item) => ({
      name: str(item.name) ?? 'Unknown item',
      qty: num(item.qty, 1),
      unit_price: num(item.unit_price, 0),
      line_total: num(item.line_total, 0),
      confidence:
        typeof item.confidence === 'number' ? item.confidence : undefined,
    })),
    service_charge: num(raw.service_charge, 0),
    tax: num(raw.tax, 0),
    printed_total_lbp:
      typeof raw.printed_total_lbp === 'number' ? raw.printed_total_lbp : null,
    printed_total_usd:
      typeof raw.printed_total_usd === 'number' ? raw.printed_total_usd : null,
  }
}

/** The single swappable provider call: image -> structured receipt JSON. */
export async function callVisionModel(
  bytes: ArrayBuffer,
  mimeType: string,
): Promise<ExtractedReceipt> {
  const accountId = process.env.CF_AIG_ACCOUNT_ID
  const gateway = process.env.CF_AIG_GATEWAY
  // Default to the Lite tier: receipt extraction passes the reconcile checksum
  // just as well there, and 3.5-flash is ~18x the price per scan.
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-lite'
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

  // v1beta, not v1: structured output (responseMimeType/responseSchema) only
  // exists in Google's v1beta GenerationConfig.
  const endpoint = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gateway}/google-ai-studio/v1beta/models/${model}:generateContent`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // Cap any cache entry at 24h when gateway caching is enabled.
      'cf-aig-cache-ttl': '86400',
      // Keep gateway request/timing/token metadata, but never persist the
      // receipt image or extracted JSON in AI Gateway logs.
      'cf-aig-collect-log-payload': 'false',
      ...(apiKey ? { 'x-goog-api-key': apiKey } : {}),
      ...(gatewayToken
        ? { 'cf-aig-authorization': `Bearer ${gatewayToken}` }
        : {}),
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { inline_data: { mime_type: mimeType, data: toBase64(bytes) } },
            { text: RECEIPT_EXTRACTION_PROMPT },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RECEIPT_RESPONSE_SCHEMA,
        temperature: 0,
      },
    }),
  })

  if (!res.ok) {
    // Provider error bodies can echo request/response content. Keep them out of
    // retrier and Convex logs; the HTTP status is sufficient operational data.
    throw new Error(`Vision model error ${res.status}`)
  }
  const json = await res.json()
  const raw: string | undefined =
    json?.candidates?.[0]?.content?.parts?.[0]?.text
  invariant(raw, 'no text in vision model response')
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  return normalizeExtracted(JSON.parse(cleaned) as ExtractedReceipt)
}
