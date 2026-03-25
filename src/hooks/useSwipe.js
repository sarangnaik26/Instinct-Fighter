import { useEffect } from 'react'

export const useSwipe = (onSwipe, targetRef = null) => {
  useEffect(() => {
    let startX = 0, startY = 0
    const MIN_SWIPE = 30

    const onTouchStart = (e) => {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
    }

    const onTouchEnd = (e) => {
      const dx = e.changedTouches[0].clientX - startX
      const dy = e.changedTouches[0].clientY - startY
      if (Math.abs(dx) < MIN_SWIPE && Math.abs(dy) < MIN_SWIPE) return

      if (Math.abs(dx) > Math.abs(dy)) {
        onSwipe(dx > 0 ? 'right' : 'left')
      } else {
        onSwipe(dy > 0 ? 'down' : 'up')
      }
    }

    const target = targetRef?.current || window
    target.addEventListener('touchstart', onTouchStart, { passive: true })
    target.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      target.removeEventListener('touchstart', onTouchStart)
      target.removeEventListener('touchend', onTouchEnd)
    }
  }, [onSwipe])
}
