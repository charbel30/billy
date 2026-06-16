// Convex actions can read environment variables via `process.env` at runtime,
// but the Convex runtime isn't Node, so we don't load @types/node. Declare just
// the `process.env` shape we use, to satisfy the typecheck without inviting other
// Node-only globals that would fail at runtime.
declare const process: { env: Record<string, string | undefined> }
