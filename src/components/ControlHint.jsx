import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { isMobileDevice } from '../utils/deviceDetect'

export default function ControlHint({ hint }) {
  const [visible, setVisible] = useState(true)
  const isMobile = isMobileDevice()

  useEffect(() => {
    if (isMobile) return // No hint needed on mobile - controls are intuitive
    const t = setTimeout(() => setVisible(false), 4000)
    const hide = () => setVisible(false)
    window.addEventListener('keydown', hide)
    window.addEventListener('click', hide)
    return () => { clearTimeout(t); window.removeEventListener('keydown', hide); window.removeEventListener('click', hide) }
  }, [])

  if (isMobile) return null

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
        >
          <div className="bg-black/70 border border-white/20 rounded-xl px-4 py-2 text-white/70 font-body text-sm whitespace-nowrap">
            🖥️ {hint}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
