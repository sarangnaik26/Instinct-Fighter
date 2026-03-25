import { useEffect, useRef } from 'react'

// Returns normalized x/y from -1 to 1 via posRef
export default function VirtualJoystick({ posRef, visible = true }) {
  const baseRef = useRef(null)
  const thumbRef = useRef(null)
  const touchRef = useRef(null)
  const RADIUS = 50
  const THUMB_R = 24

  useEffect(() => {
    const base = baseRef.current
    if (!base) return

    const onTouchStart = (e) => {
      e.preventDefault()
      touchRef.current = e.touches[0].identifier
    }

    const onTouchMove = (e) => {
      e.preventDefault()
      const touch = Array.from(e.touches).find(t => t.identifier === touchRef.current)
      if (!touch) return

      const rect = base.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      let dx = touch.clientX - cx
      let dy = touch.clientY - cy
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist > RADIUS) {
        dx = (dx / dist) * RADIUS
        dy = (dy / dist) * RADIUS
      }

      if (thumbRef.current) {
        thumbRef.current.style.transform = `translate(${dx}px, ${dy}px)`
      }

      if (posRef) {
        posRef.current = { x: dx / RADIUS, y: dy / RADIUS }
      }
    }

    const onTouchEnd = () => {
      if (thumbRef.current) {
        thumbRef.current.style.transform = 'translate(0px, 0px)'
      }
      if (posRef) posRef.current = { x: 0, y: 0 }
    }

    base.addEventListener('touchstart', onTouchStart, { passive: false })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)

    return () => {
      base.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [posRef])

  if (!visible) return null

  return (
    <div
      ref={baseRef}
      className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 rounded-full border-4 border-white/30 bg-black/30 flex items-center justify-center"
      style={{ width: RADIUS * 2 + THUMB_R, height: RADIUS * 2 + THUMB_R }}
    >
      <div
        ref={thumbRef}
        className="rounded-full bg-white/60 border-2 border-white/80 transition-none"
        style={{ width: THUMB_R * 2, height: THUMB_R * 2, transition: 'transform 0.05s' }}
      />
    </div>
  )
}
