import { createFileRoute } from '@tanstack/react-router'
import { ScannerHub } from '~/components/scan/ScannerHub'

export const Route = createFileRoute('/')({
  component: ScannerHub,
})
