import { createFileRoute } from '@tanstack/react-router'
import { ScannerHub } from '~/components/features/scan/ScannerHub'

export const Route = createFileRoute('/')({
  component: ScannerHub,
})
