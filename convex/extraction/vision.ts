import type { ExtractedReceipt } from '../../src/lib/types'
import { invariant } from '../lib/invariant'
import { RECEIPT_EXTRACTION_PROMPT } from './prompt'

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
export async function callVisionModel(
  bytes: ArrayBuffer,
  mimeType: string,
): Promise<ExtractedReceipt> {
  const accountId = process.env.CF_AIG_ACCOUNT_ID
  const gateway = process.env.CF_AIG_GATEWAY
  const model = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash'
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
    }),
  })

  if (!res.ok) {
    throw new Error(`Vision model error ${res.status}: ${await res.text()}`)
  }
  const json = await res.json()
  const raw: string | undefined =
    json?.candidates?.[0]?.content?.parts?.[0]?.text
  invariant(raw, 'no text in vision model response')
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  return JSON.parse(cleaned) as ExtractedReceipt
}
