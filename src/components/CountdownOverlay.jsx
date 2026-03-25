import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function CountdownOverlay({ onDone }) {
  const [count, setCount] = useState(3)

  useEffect(() => {
    if (count === 0) { onDone(); return }
    const t = setTimeout(() => setCount(c => c - 1), 800)
    return () => clearTimeout(t)
  }, [count])

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <AnimatePresence mode="wait">
        <motion.div
          key={count}
          initial={{ scale: 2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="font-display text-white"
          style={{ fontSize: count === 0 ? '4rem' : '7rem', textShadow: '4px 4px 0 #000' }}
        >
          {count === 0 ? 'GO! 🚀' : count}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
