import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Maximize2, RefreshCw, ShieldCheck } from 'lucide-react'

import './puzzle-cam-portal.css'

const PUZZLE_CAM_URL = '/puzzle-cam/index.html'
const SHELL_TIMEOUT_MS = 30_000

type PuzzleMessage = {
  type?: string
  version?: number
}

export default function PuzzleCamPortal() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const frameSrc = useMemo(
    () => `${PUZZLE_CAM_URL}?ryka-embed=1&v=${reloadToken}`,
    [reloadToken],
  )

  useEffect(() => {
    setReady(false)
    setLoadError(null)

    const handleMessage = (event: MessageEvent<PuzzleMessage>) => {
      if (event.origin !== window.location.origin) return
      if (event.source !== iframeRef.current?.contentWindow) return
      if (event.data?.type !== 'ryka:puzzle-shell-ready') return

      setReady(true)
      setLoadError(null)
    }

    window.addEventListener('message', handleMessage)
    const timeout = window.setTimeout(() => {
      setLoadError(
        'Shell Puzzle Cam tidak merespons. Periksa public/puzzle-cam/index.html lalu muat ulang server Vite.',
      )
    }, SHELL_TIMEOUT_MS)

    return () => {
      window.removeEventListener('message', handleMessage)
      window.clearTimeout(timeout)
    }
  }, [reloadToken])

  const reloadModule = useCallback(() => {
    setReloadToken((value) => value + 1)
  }, [])

  const openFullscreen = useCallback(async () => {
    const frame = iframeRef.current
    if (!frame) return

    try {
      await frame.requestFullscreen()
    } catch {
      window.open(PUZZLE_CAM_URL, '_blank', 'noopener,noreferrer')
    }
  }, [])

  const handleFrameLoad = useCallback(() => {
    // onLoad dapat tertunda oleh module MediaPipe dari CDN. Pesan shell-ready adalah
    // sinyal utama, sedangkan event ini menjadi fallback untuk browser tertentu.
    setReady(true)
    setLoadError(null)
  }, [])

  return (
    <main className="ryka-puzzle-portal">
      <header className="ryka-puzzle-portal__header">
        <div>
          <span className="ryka-puzzle-portal__eyebrow">RYKA CREATIVE MODULE / V2</span>
          <h1>MOTION PUZZLE LAB</h1>
          <p>Gesture capture, puzzle interaktif, photo strip, dan creative editor.</p>
        </div>

        <div className="ryka-puzzle-portal__actions">
          <button type="button" onClick={reloadModule}>
            <RefreshCw size={15} aria-hidden="true" />
            Reload
          </button>
          <button type="button" onClick={openFullscreen}>
            <Maximize2 size={15} aria-hidden="true" />
            Fullscreen
          </button>
          <a href={PUZZLE_CAM_URL} target="_blank" rel="noreferrer">
            <ExternalLink size={15} aria-hidden="true" />
            Standalone
          </a>
        </div>
      </header>

      <section className="ryka-puzzle-portal__frame-wrap">
        {!ready && !loadError && (
          <div className="ryka-puzzle-portal__loading" role="status" aria-live="polite">
            <span />
            Menyiapkan antarmuka Motion Puzzle Lab…
          </div>
        )}

        {loadError && (
          <div className="ryka-puzzle-portal__error" role="alert">
            <strong>MODUL BELUM DAPAT DIBUKA</strong>
            <p>{loadError}</p>
            <div>
              <button type="button" onClick={reloadModule}>COBA LAGI</button>
              <a href={PUZZLE_CAM_URL} target="_blank" rel="noreferrer">BUKA STANDALONE</a>
            </div>
          </div>
        )}

        <iframe
          key={reloadToken}
          ref={iframeRef}
          title="RYKA Motion Puzzle Lab"
          src={frameSrc}
          allow="camera; fullscreen; clipboard-write"
          allowFullScreen
          referrerPolicy="no-referrer"
          onLoad={handleFrameLoad}
          onError={() => setLoadError('Browser gagal membuka dokumen Puzzle Cam.')}
        />
      </section>

      <footer className="ryka-puzzle-portal__privacy">
        <ShieldCheck size={14} aria-hidden="true" />
        Kamera diproses di browser. Tidak ada rekaman video yang disimpan otomatis.
      </footer>
    </main>
  )
}
