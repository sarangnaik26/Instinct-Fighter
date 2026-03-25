import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { GAMES } from '../data/games'
import { startBgMusic, resumeCtx, sfx } from '../audio/audioManager'
import MuteButton from '../components/MuteButton'
import ThemeToggle from '../components/ThemeToggle'
import { getAllBestScores } from '../utils/scoreHelpers'
import { useTheme } from '../context/ThemeContext'

export default function HomePage() {
  const navigate = useNavigate()
  const { isDark } = useTheme()

  useEffect(() => {
    resumeCtx()
    startBgMusic()
  }, [])

  const handleGameClick = (gameId) => {
    sfx.click()
    navigate(`/game/${gameId}`)
  }

  return (
    <div className="relative w-full h-full scrollable" style={{ background: 'var(--bg)' }}>
      <ThemeToggle />
      <MuteButton />

      {/* Decorative background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 rounded-full"
          style={{ background: 'radial-gradient(circle, #FF6B6B, transparent)', opacity: isDark ? 0.1 : 0.06, transform: 'translate(-30%, -30%)' }} />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full"
          style={{ background: 'radial-gradient(circle, #4ECDC4, transparent)', opacity: isDark ? 0.1 : 0.06, transform: 'translate(30%, 30%)' }} />
      </div>

      <div className="relative z-10 px-4 pb-8">
        {/* Header */}
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center pt-10 pb-6"
        >
          <motion.div
            animate={{ rotate: [0, -5, 5, -5, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            className="text-6xl mb-3"
          >
            🥊
          </motion.div>
          <h1 className="font-display text-5xl mb-2 theme-text"
            style={{ textShadow: '4px 4px 0 #FF6B6B' }}>
            Instinct Fighter
          </h1>
          <p className="font-body text-base max-w-xs mx-auto theme-muted">
            Your muscle memory is the enemy. Can you fight your own instincts?
          </p>

          {/* Mode legend */}
          <div className="flex gap-3 justify-center mt-4">
            {[
              { emoji: '🟢', label: 'Normal', color: '#55EFC4' },
              { emoji: '🔴', label: 'Instinct', color: '#FF6B6B' },
              { emoji: '⚡', label: 'Trauma', color: '#FFE66D' },
            ].map(m => (
              <div key={m.label}
                className="cartoon-card px-2 py-1 text-xs font-display flex items-center gap-1"
                style={{ background: 'var(--bg-card)', color: m.color }}>
                {m.emoji} {m.label}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Games grid */}
        <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
          {GAMES.map((game, i) => {
            const scores = getAllBestScores(game.id)
            const hasPlayed = scores.normal > 0 || scores.instinct > 0 || scores.trauma > 0

            return (
              <motion.button
                key={game.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => handleGameClick(game.id)}
                className="cartoon-card p-4 text-left relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${game.cardColor}CC, ${game.cardColor}88)` }}
              >
                <div className="absolute -right-3 -bottom-3 text-6xl opacity-20 pointer-events-none">
                  {game.emoji}
                </div>
                <div className="text-3xl mb-2">{game.emoji}</div>
                <div className="font-display text-white text-base leading-tight mb-1">{game.name}</div>
                <div className="font-body text-white/60 text-xs mb-2">{game.controlType}</div>
                {hasPlayed && (
                  <div className="flex gap-1">
                    {scores.normal > 0 && <span className="text-xs">🟢</span>}
                    {scores.instinct > 0 && <span className="text-xs">🔴</span>}
                    {scores.trauma > 0 && <span className="text-xs">⚡</span>}
                  </div>
                )}
              </motion.button>
            )
          })}
        </div>

        <div className="text-center mt-8 font-body text-xs theme-muted">
          9 games • 3 modes each • Fight your instincts
        </div>
      </div>
    </div>
  )
}
