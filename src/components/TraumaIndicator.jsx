import { motion, AnimatePresence } from 'framer-motion'

export default function TraumaIndicator({ isInverted, justFlipped }) {
  return (
    <AnimatePresence>
      <motion.div
        key={isInverted ? 'inverted' : 'normal'}
        initial={{ scale: 1.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
      >
        <div
          className={`cartoon-card px-4 py-2 flex items-center gap-2 font-display text-sm
            ${isInverted
              ? 'bg-red-600 text-white border-black'
              : 'bg-green-500 text-white border-black'
            } ${justFlipped ? 'trauma-flash' : ''}`}
        >
          <span className="text-xl">{isInverted ? '🔴' : '🟢'}</span>
          <span>{isInverted ? 'REVERSED!' : 'NORMAL'}</span>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
