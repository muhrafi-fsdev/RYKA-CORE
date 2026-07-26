import { createFileRoute } from '@tanstack/react-router'
import HandTracker from '@/components/HandTracker'

export const Route = createFileRoute('/access')({
  component: AccessPage,
  head: () => ({
    meta: [
      { title: 'RYKA Access | Personal Communication' },
      {
        name: 'description',
        content:
          'Mode komunikasi aksesibel RYKA CORE dengan gesture-to-text, quick phrase board, text-to-speech, live caption, dan Partner Display.',
      },
    ],
  }),
})

function AccessPage() {
  return <HandTracker />
}
