# Receipt extraction: model choice & pipeline

The vision-LLM extraction (spec §4) runs in a Convex **action** (only actions can `fetch` —
see `actions-external-apis.md`). This file records the model decision and the call shape.

## Decided architecture

```
image (compressed client-side, stored in Convex)
   │
   ▼
Convex action  ──►  Cloudflare AI Gateway  ──►  Gemini (vision)   [PRIMARY]
   │                  (caching, retries,        structured JSON out
   │                   fallback, cost analytics)
   ▼
reconcile.ts  — arithmetic checksum: Σ line_total (+ service + tax) == printed_total?
   ├─ pass + high confidence  → status READY
   └─ fail / low confidence   → escalate (stronger VLM) OR flag NEEDS_REVIEW
```

- **Primary model: Gemini (vision).** Tops current OCR leaderboards, cheap, generous free
  tier, strong multilingual (English/French/Arabic — the Lebanese receipt mix). Called over
  HTTP from the action; the API key lives in Convex env vars, never the browser.
- **Route through Cloudflare AI Gateway**, not the provider endpoint directly. The action's
  `fetch` targets the Gateway URL — you get response caching, automatic retries, provider
  fallback, and per-scan cost/latency analytics for free, and switching providers is a
  URL/headers change. (The team already uses Cloudflare, so this stays in-stack.)
- **Keep the provider behind one interface** (`src/lib/extract` types + the action). Swapping
  Gemini → Claude/Qwen later must be a one-file change. The spec mandates this swappability.

## Why a general VLM, not an OCR specialist

The differentiator is **reasoning**, not transcription: recover an occluded quantity from the
printed `line_total`/totals (spec §4.2, Appendix A). OCR specialists (GLM-OCR, dots.ocr,
PaddleOCR) transcribe cheaply but **cannot reason** about totals — so they can't do this. Use a
general vision LLM as the primary extractor.

## The fallback the team chose: OCR → LLM

If Gemini's direct image→JSON quality is poor (esp. on Arabic or noisy scans), fall back to a
**two-stage** path: run an OCR engine first (PaddleOCR / a hosted OCR API) to get clean text +
layout, then feed that **text** to a cheaper text-LLM to structure + reason. This is easier and
cheaper to process than raw pixels and sidesteps weak vision on hard scans. Wire it as a second
implementation of the same extractor interface, selected per-bill or by a config flag — don't
fork the pipeline.

> This matches the spec's deferred "server-side OCR fallback (PaddleOCR) if Arabic receipts
> become frequent." Treat it as the escalation/fallback tier, not the default.

## Open-weight option (cost/control later)

When volume justifies it, swap the primary to **Qwen3-VL** (32-language OCR incl. Arabic, strong
structured output) or **InternVL3.5** (document understanding). Run them with **zero ops** via
serverless inference (OpenRouter / Together / Fireworks) or **Cloudflare Workers AI** behind the
same AI Gateway — self-host GPUs only at real volume or for image-never-leaves-our-cloud privacy.

## Call requirements (whichever model)

- **Structured output / JSON schema** for the line-item shape so you don't pay for
  malformed-JSON retries. Use the provider's structured-output mode.
- **Cache the schema + system prompt** — it's byte-identical every scan; only the image varies.
- **Downsample the image** client-side to the lowest resolution where text is still legible —
  image tokens dominate cost.
- Persist results via a single idempotent mutation keyed on `billId` (actions can retry).

## Before committing the model: run a real eval

Leaderboards don't test Lebanese receipts. Run **20–30 real receipts** (clean + occluded +
Arabic) through 2–3 candidates and compare **checksum pass-rate** and **cost/scan**. That decides
it for your data better than any benchmark blog.
