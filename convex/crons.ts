import { cronJobs } from 'convex/server'

// No scheduled jobs in the Phase 1 MVP. Phase 2 will add an FX-rate refresh and an
// image-TTL purge here (spec §5, §10).
const crons = cronJobs()

export default crons
