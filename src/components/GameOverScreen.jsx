import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { sfx } from '../audio/audioManager'
import { MODE_INFO } from '../data/games'

export default function GameOverScreen({ score, bestScore, isNewRecord, scoreUnit, mode, gameId, onRetry }) {
  const navigate = useNavigate()
  const modeInfo = MODE_INFO[mode]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: 40 }}
        animate={{ y: 0 }}
        className="cartoon-card bg-bg-card border-black p-6 mx-4 w-full max-w-sm text-center"
        style={{ borderColor: modeInfo.color, boxShadow: `6px 6px 0px ${modeInfo.color}` }}
      >
        {/* Title */}
        <div className="text-5xl mb-2">💀</div>
        <h2 className="font-display text-4xl text-white mb-1">Game Over!</h2>
        <div className="text-sm font-body text-gray-400 mb-4" style={{ color: modeInfo.color }}>
          {modeInfo.emoji} {modeInfo.label} Mode
        </div>

        {/* Score */}
        <div className="cartoon-card bg-black/40 border-gray-600 p-4 mb-4">
          <div className="text-gray-400 font-body text-sm mb-1">Your Score</div>
          <div className="font-display text-5xl text-white">
            {score}{scoreUnit ? ` ${scoreUnit}` : ''}
          </div>
          {isNewRecord && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              className="mt-2 text-yellow-400 font-display text-lg"
            >
              🏆 New Record!
            </motion.div>
          )}
        </div>

        {/* Best */}
        <div className="text-gray-400 font-body text-sm mb-6">
          Best: <span className="text-white font-bold">{bestScore}{scoreUnit ? ` ${scoreUnit}` : ''}</span>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => { sfx.click(); navigate('/') }}
            className="cartoon-btn flex-1 py-3 bg-gray-700 text-white text-lg border-black"
          >
            🏠 Home
          </button>
          <button
            onClick={() => { sfx.click(); onRetry() }}
            className="cartoon-btn flex-1 py-3 text-black text-lg border-black font-display"
            style={{ backgroundColor: modeInfo.color }}
          >
            ▶ Retry
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
