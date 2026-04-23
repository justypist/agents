'use client';

import type { UIMessage } from 'ai';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type WheelEvent,
} from 'react';
import { createPortal } from 'react-dom';

type FilePartData = Extract<UIMessage['parts'][number], { type: 'file' }>;

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const SCALE_STEP = 0.25;

type Point = {
  x: number;
  y: number;
};

export function FilePart({ part }: { part: FilePartData }) {
  if (!isImageFile(part)) {
    return (
      <a
        href={part.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
      >
        <span className="truncate">{part.filename ?? part.mediaType}</span>
        <span className="text-xs text-muted-foreground">{part.mediaType}</span>
      </a>
    );
  }

  return <ImageFilePart part={part} />;
}

function ImageFilePart({ part }: { part: FilePartData }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [scale, setScale] = useState(MIN_SCALE);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const dragOriginRef = useRef<Point>({ x: 0, y: 0 });
  const pointerOriginRef = useRef<Point>({ x: 0, y: 0 });
  const activePointerIdRef = useRef<number | null>(null);

  const closePreview = useCallback(() => {
    setIsOpen(false);
    setIsDragging(false);
    setScale(MIN_SCALE);
    setOffset({ x: 0, y: 0 });
  }, []);

  const openPreview = useCallback(() => {
    setIsOpen(true);
    setScale(MIN_SCALE);
    setOffset({ x: 0, y: 0 });
  }, []);

  const updateScale = useCallback((nextScale: number) => {
    const normalizedScale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    setScale(normalizedScale);
    if (normalizedScale === MIN_SCALE) {
      setOffset({ x: 0, y: 0 });
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePreview();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closePreview, isOpen]);

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLImageElement>) => {
      if (scale <= MIN_SCALE) {
        return;
      }

      activePointerIdRef.current = event.pointerId;
      setIsDragging(true);
      pointerOriginRef.current = { x: event.clientX, y: event.clientY };
      dragOriginRef.current = offset;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [offset, scale],
  );

  const handlePointerMove = useCallback((event: PointerEvent<HTMLImageElement>) => {
    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }

    setOffset({
      x: dragOriginRef.current.x + event.clientX - pointerOriginRef.current.x,
      y: dragOriginRef.current.y + event.clientY - pointerOriginRef.current.y,
    });
  }, []);

  const handlePointerUp = useCallback((event: PointerEvent<HTMLImageElement>) => {
    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }

    activePointerIdRef.current = null;
    setIsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      updateScale(scale - Math.sign(event.deltaY) * SCALE_STEP);
    },
    [scale, updateScale],
  );

  const preview =
    isOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/85"
            role="dialog"
            aria-modal="true"
            aria-label={part.filename ?? '图片预览'}
            onClick={closePreview}
          >
            <div className="flex h-full w-full flex-col" onWheel={handleWheel}>
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-sm text-white/80">
                <div className="min-w-0">
                  <p className="truncate text-white">{part.filename ?? '图片附件'}</p>
                  <p className="truncate text-xs text-white/60">{part.mediaType}</p>
                </div>
                <div className="flex items-center gap-2" onClick={event => event.stopPropagation()}>
                  <button
                    type="button"
                    className="border border-white/15 px-3 py-1.5 text-white transition-colors hover:bg-white/10"
                    onClick={() => updateScale(scale - SCALE_STEP)}
                  >
                    -
                  </button>
                  <button
                    type="button"
                    className="border border-white/15 px-3 py-1.5 text-white transition-colors hover:bg-white/10"
                    onClick={() => updateScale(MIN_SCALE)}
                  >
                    {Math.round(scale * 100)}%
                  </button>
                  <button
                    type="button"
                    className="border border-white/15 px-3 py-1.5 text-white transition-colors hover:bg-white/10"
                    onClick={() => updateScale(scale + SCALE_STEP)}
                  >
                    +
                  </button>
                  <a
                    href={part.url}
                    target="_blank"
                    rel="noreferrer"
                    className="border border-white/15 px-3 py-1.5 text-white transition-colors hover:bg-white/10"
                  >
                    原图
                  </a>
                  <button
                    type="button"
                    className="border border-white/15 px-3 py-1.5 text-white transition-colors hover:bg-white/10"
                    onClick={closePreview}
                  >
                    关闭
                  </button>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4" onClick={closePreview}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={part.url}
                  alt={part.filename ?? '聊天图片附件'}
                  className={scale > MIN_SCALE ? 'max-h-[82vh] max-w-[90vw] select-none object-contain cursor-grab active:cursor-grabbing' : 'max-h-[82vh] max-w-[90vw] select-none object-contain cursor-zoom-in'}
                  draggable={false}
                  onClick={event => event.stopPropagation()}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  style={{
                    touchAction: scale > MIN_SCALE ? 'none' : 'auto',
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                    transition: isDragging ? 'none' : 'transform 120ms ease-out',
                  }}
                />
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        className="group flex max-w-fit flex-col gap-2 text-left"
        onClick={openPreview}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={part.url}
          alt={part.filename ?? '聊天图片附件'}
          className="max-h-80 max-w-full border border-border object-contain transition-opacity group-hover:opacity-90 sm:max-w-xl"
          loading="lazy"
        />
        <span className="text-xs text-muted-foreground">
          点击放大 {part.filename != null ? `· ${part.filename}` : ''}
        </span>
      </button>
      {preview}
    </>
  );
}

function isImageFile(part: FilePartData): boolean {
  if (part.mediaType.startsWith('image/')) {
    return true;
  }

  return /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(part.filename ?? '');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
