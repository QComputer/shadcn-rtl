"use client"

import * as React from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type PremiumProductGalleryProps = {
  images: string[]
  alt: string
  resetKey: string
}

export function PremiumProductGallery(props: PremiumProductGalleryProps) {
  return <Gallery key={props.resetKey} {...props} />
}

function Gallery({ images, alt }: PremiumProductGalleryProps) {
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [loaded, setLoaded] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const touchStart = React.useRef<number | null>(null)
  const safeImages = images.filter(Boolean)
  const activeImage = safeImages[activeIndex]
  const multiple = safeImages.length > 1

  const select = (index: number) => {
    if (!safeImages.length) return
    const nextIndex = (index + safeImages.length) % safeImages.length
    if (nextIndex === activeIndex) return
    setActiveIndex(nextIndex)
    setLoaded(false)
  }
  const next = () => select(activeIndex + 1)
  const previous = () => select(activeIndex - 1)
  const onTouchStart = (event: React.TouchEvent) => { touchStart.current = event.touches[0]?.clientX ?? null }
  const onTouchEnd = (event: React.TouchEvent) => {
    const endX = event.changedTouches[0]?.clientX
    if (touchStart.current !== null && endX !== undefined) {
      const delta = endX - touchStart.current
      if (Math.abs(delta) > 48) { if (delta > 0) previous(); else next() }
    }
    touchStart.current = null
  }
  const onGalleryKeyDown = (event: React.KeyboardEvent) => {
    if (!multiple) return
    // In an RTL gallery, the next item sits to the left.
    if (event.key === "ArrowLeft") {
      event.preventDefault()
      next()
    } else if (event.key === "ArrowRight") {
      event.preventDefault()
      previous()
    }
  }

  if (!activeImage) {
    return (
      <div className="flex aspect-[4/5] w-full items-center justify-center rounded-3xl border border-stone-200/80 bg-stone-50 px-6 text-center text-sm text-stone-500">
        تصویری برای این محصول ثبت نشده است
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="space-y-4" dir="rtl" onKeyDown={onGalleryKeyDown}>
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label="بزرگ‌نمایی تصویر محصول"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            className="group relative block aspect-[4/5] w-full overflow-hidden rounded-3xl border border-stone-200/80 bg-[#f7f6f3] text-right shadow-[0_18px_50px_-38px_rgba(28,25,23,0.35)] outline-none transition-[border-color,box-shadow] hover:border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-500 focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            {!loaded && <div className="absolute inset-0 animate-pulse bg-stone-200/60 motion-reduce:animate-none" aria-hidden="true" />}
            <Image
              key={activeImage}
              src={activeImage}
              alt={alt}
              fill
              unoptimized
              priority={activeIndex === 0}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 560px"
              onLoad={() => setLoaded(true)}
              onError={() => setLoaded(true)}
              className={cn(
                "object-contain p-7 transition-[opacity,transform] duration-500 ease-out group-hover:scale-[1.025] sm:p-10 motion-reduce:transform-none motion-reduce:transition-none",
                loaded ? "opacity-100" : "opacity-0",
              )}
            />
            <span className="absolute bottom-4 left-4 inline-flex h-11 items-center gap-2 rounded-full border border-white/80 bg-white/90 px-3.5 text-xs font-medium text-stone-700 shadow-sm backdrop-blur transition-colors group-hover:bg-white motion-reduce:transition-none">
              <Maximize2 className="size-4" aria-hidden="true" />
              بزرگ‌نمایی
            </span>
            {multiple && (
              <span className="absolute right-4 top-4 rounded-full bg-white/85 px-3 py-1.5 text-xs tabular-nums text-stone-600 shadow-sm backdrop-blur">
                {activeIndex + 1} / {safeImages.length}
              </span>
            )}
          </button>
        </DialogTrigger>

        {multiple && (
          <div className="flex items-center gap-3" aria-label="نماهای محصول">
            <div className="flex min-w-0 flex-1 gap-2.5 overflow-x-auto py-1">
              {safeImages.map((src, index) => (
                <button
                  key={`${src}-${index}`}
                  type="button"
                  aria-label={`نمای ${index + 1}`}
                  aria-pressed={activeIndex === index}
                  onClick={() => select(index)}
                  className={cn(
                    "relative size-[68px] shrink-0 overflow-hidden rounded-2xl border bg-[#f7f6f3] p-1 transition-[border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500 focus-visible:ring-offset-2 motion-reduce:transition-none sm:size-[76px]",
                    activeIndex === index ? "border-stone-800 ring-1 ring-stone-800" : "border-stone-200 hover:border-stone-400",
                  )}
                >
                  <Image src={src} alt="" fill unoptimized sizes="76px" className="object-contain p-1.5" />
                </button>
              ))}
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" aria-label="نمای قبلی" onClick={previous} className="grid size-11 place-items-center rounded-full border border-stone-200 bg-white text-stone-700 transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500 motion-reduce:transition-none">
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
              <button type="button" aria-label="نمای بعدی" onClick={next} className="grid size-11 place-items-center rounded-full border border-stone-200 bg-white text-stone-700 transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500 motion-reduce:transition-none">
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>

      <DialogContent
        dir="rtl"
        aria-describedby={undefined}
        className="flex h-[min(92dvh,900px)] w-[min(96vw,1100px)] max-w-none flex-col gap-0 border-0 bg-[#f7f6f3] p-3 shadow-2xl sm:rounded-3xl sm:p-5 [&>button]:hidden"
        onKeyDown={onGalleryKeyDown}
      >
        <DialogTitle className="sr-only">نمایش تصویر محصول</DialogTitle>
        <div className="absolute left-4 top-4 z-20"><DialogClose asChild><button type="button" aria-label="بستن تصویر" className="grid size-11 place-items-center rounded-full bg-white text-stone-800 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-stone-700"><X className="size-5" aria-hidden="true" /></button></DialogClose></div>
        <div
          className="relative min-h-0 flex-1 overflow-hidden rounded-2xl"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {!loaded && <div className="absolute inset-0 animate-pulse bg-stone-200/60 motion-reduce:animate-none" aria-hidden="true" />}
          <Image
            key={activeImage}
            src={activeImage}
            alt={alt}
            fill
            unoptimized
            sizes="96vw"
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
            className={cn("object-contain p-3 transition-opacity duration-300 sm:p-8 motion-reduce:transition-none", loaded ? "opacity-100" : "opacity-0")}
          />
        </div>
        {multiple && (
          <div className="flex items-center justify-center gap-3 pt-3">
            <button type="button" aria-label="نمای قبلی" onClick={previous} className="grid size-11 place-items-center rounded-full border border-stone-200 bg-white text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500">
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
            <span className="min-w-16 text-center text-sm tabular-nums text-stone-600">{activeIndex + 1} / {safeImages.length}</span>
            <button type="button" aria-label="نمای بعدی" onClick={next} className="grid size-11 place-items-center rounded-full border border-stone-200 bg-white text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500">
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
