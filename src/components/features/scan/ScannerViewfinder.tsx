import { motion } from 'motion/react'
import { RiCameraLine } from '@remixicon/react'
import { cn } from '~/lib/utils'
import { scanHubCopy } from './content'

export function ScannerViewfinder({
  busy,
  previewUrl,
}: {
  busy: boolean
  previewUrl: string | null
}) {
  if (previewUrl) {
    return (
      <section className="relative aspect-[3/4] overflow-hidden rounded-4xl border border-border/70 bg-muted">
        <img
          src={previewUrl}
          alt="Receipt photo preview"
          className="absolute inset-0 size-full object-contain"
        />
        <ScannerCorners />
        <div className="absolute inset-x-0 bottom-8 flex justify-center">
          <div className="rounded-full bg-background/80 px-4 py-2 text-xs font-semibold text-muted-foreground shadow-sm backdrop-blur">
            {busy
              ? scanHubCopy.scanningStatus
              : 'Readable? Whole receipt in frame?'}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="relative aspect-[3/4] overflow-hidden rounded-4xl border border-border/70 bg-muted">
      <ScannerCorners />

      <motion.div
        className="absolute left-0 z-10 h-0.5 w-full bg-primary shadow-[0_0_16px_rgba(0,0,0,0.35)]"
        initial={{ top: '0%', opacity: 0 }}
        animate={{ top: ['0%', '100%'], opacity: [0, 1, 1, 0] }}
        transition={{
          duration: busy ? 1.4 : 2.5,
          repeat: Infinity,
          ease: [0.4, 0, 0.2, 1],
        }}
      />

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-1/2 w-2/3 flex-col gap-3 opacity-60">
          {[72, 48, 100, 84, 64].map((width, index) => (
            <div
              key={width}
              className={cn(
                'relative h-3 overflow-hidden rounded-full bg-border',
                index === 2 ? 'mt-6' : '',
              )}
              style={{ width: `${width}%` }}
            >
              <motion.div
                className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-background/60 to-transparent"
                initial={{ x: '-120%' }}
                animate={{ x: '240%' }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'linear',
                  delay: index * 0.12,
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-8 flex justify-center">
        <div className="flex items-center gap-2 rounded-full bg-background/80 px-4 py-2 text-xs font-semibold text-muted-foreground shadow-sm backdrop-blur">
          <RiCameraLine className={cn('size-4', busy ? 'animate-pulse text-primary' : '')} />
          {busy ? scanHubCopy.scanningStatus : scanHubCopy.readyStatus}
        </div>
      </div>
    </section>
  )
}

function ScannerCorners() {
  const cornerClass = 'absolute size-8 border-primary'
  return (
    <>
      <div className={cn(cornerClass, 'left-6 top-6 rounded-tl-xl border-l-4 border-t-4')} />
      <div className={cn(cornerClass, 'right-6 top-6 rounded-tr-xl border-r-4 border-t-4')} />
      <div className={cn(cornerClass, 'bottom-6 left-6 rounded-bl-xl border-b-4 border-l-4')} />
      <div className={cn(cornerClass, 'bottom-6 right-6 rounded-br-xl border-b-4 border-r-4')} />
    </>
  )
}
