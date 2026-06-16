# File storage (receipt images)

The spec defaults to **not** storing receipt images (privacy). If you do keep them (e.g. for
re-review), use Convex file storage with a short lifetime and store only the `Id<'_storage'>`.

## Upload flow

1. A mutation generates a short-lived upload URL: `await ctx.storage.generateUploadUrl()`.
2. The browser `POST`s the (client-compressed) image bytes to that URL; the response returns a
   `storageId`.
3. A second mutation saves that `storageId` on the bill (`v.id('_storage')`).

## Reading

- In an action, get a servable URL with `await ctx.storage.getUrl(storageId)` (returns `null`
  if deleted). This is how the extraction action feeds the image to the vision-LLM.
- Delete with `await ctx.storage.delete(storageId)` — wire this to the user "delete" control
  and/or a cron to enforce the TTL the spec calls for.

Keep the validator as `v.id('_storage')`, never a raw string. Don't expose storage URLs in
public read-only guest views unless the user opted to keep the image.
