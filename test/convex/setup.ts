/// <reference types="vite/client" />
export { default as schema } from '../../convex/schema'

export const modules = import.meta.glob('../../convex/**/*.ts')
