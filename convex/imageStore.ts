// Storage seam — the ONLY module that names a storage backend. Today it wraps
// Convex file storage; swapping to Cloudflare R2 post-MVP means rewriting just
// these three function bodies (S3 presigned PUT / GET / delete) without touching
// any caller. The bill stores a storage-agnostic `imageRef` string (a Convex
// storageId now, an R2 object key later).

import type { ActionCtx, MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { invariant } from './invariant'

/** Create a target the browser can POST the compressed image bytes to.
 *  Returns the ref-issuing upload URL (Convex returns a storageId in the POST response). */
export async function createUploadTarget(ctx: MutationCtx): Promise<string> {
  return await ctx.storage.generateUploadUrl()
}

/** Read the stored image back as bytes + mime type, for the vision model. */
export async function readImage(
  ctx: ActionCtx,
  ref: string,
): Promise<{ bytes: ArrayBuffer; mimeType: string }> {
  const url = await ctx.storage.getUrl(ref as Id<'_storage'>)
  invariant(url, `image not found in storage: ${ref}`)
  const res = await fetch(url)
  const mimeType = res.headers.get('content-type') ?? 'image/jpeg'
  const bytes = await res.arrayBuffer()
  return { bytes, mimeType }
}

/** Delete the stored image (delete-after-extract; spec §10). */
export async function deleteImage(
  ctx: ActionCtx | MutationCtx,
  ref: string,
): Promise<void> {
  await ctx.storage.delete(ref as Id<'_storage'>)
}
