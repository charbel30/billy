import type { Id } from '../_generated/dataModel'
import type { ActionCtx, MutationCtx } from '../_generated/server'

export async function createUploadTarget(ctx: MutationCtx): Promise<string> {
  return await ctx.storage.generateUploadUrl()
}

export async function readImage(
  ctx: ActionCtx,
  imageRef: string,
): Promise<{ bytes: ArrayBuffer; mimeType: string }> {
  const fileId = imageRef as Id<'_storage'>
  const blob = await ctx.storage.get(fileId)
  if (!blob) throw new Error('receipt image not found')

  return {
    bytes: await blob.arrayBuffer(),
    mimeType: blob.type || 'image/jpeg',
  }
}

export async function deleteImage(
  ctx: ActionCtx,
  imageRef: string,
): Promise<void> {
  const fileId = imageRef as Id<'_storage'>
  await ctx.storage.delete(fileId)
}
