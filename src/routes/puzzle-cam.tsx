import { createFileRoute } from '@tanstack/react-router'
import PuzzleCamPortal from '@/components/PuzzleCamPortal'

export const Route = createFileRoute('/puzzle-cam')({
  component: PuzzleCamPage,
  head: () => ({
    meta: [
      { title: 'RYKA Puzzle Cam | Gesture Photobooth' },
      {
        name: 'description',
        content:
          'Modul photobooth interaktif RYKA CORE dengan gesture capture, sliding puzzle, filter, dan scrapbook editor.',
      },
    ],
  }),
})

function PuzzleCamPage() {
  return <PuzzleCamPortal />
}
