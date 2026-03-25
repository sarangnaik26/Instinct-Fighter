import { useState } from 'react'
import { setMuted, getMuted } from '../audio/audioManager'

export default function MuteButton() {
  const [muted, setMutedState] = useState(getMuted())

  const toggle = () => {
    const next = !muted
    setMuted(next)
    setMutedState(next)
  }

  return (
    <button
      onClick={toggle}
      className="absolute top-3 right-3 z-30 w-10 h-10 rounded-full bg-black/40 border-2 border-white/30
                 flex items-center justify-center text-xl hover:bg-black/60 transition-colors"
      aria-label={muted ? 'Unmute' : 'Mute'}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  )
}
