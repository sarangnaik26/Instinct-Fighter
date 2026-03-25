import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { GAME_MAP, MODE_INFO } from '../data/games'
import { sfx } from '../audio/audioManager'
import { getAllBestScores } from '../utils/scoreHelpers'
import MuteButton from '../components/MuteButton'
import ThemeToggle from '../components/ThemeToggle'

export default function GameSelectPage() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const game = GAME_MAP[gameId]

  if (!game) { navigate('/'); return null }

  const scores = getAllBestScores(gameId)

  const handleMode = (mode) => {
    sfx.click()
    navigate(`/play/${gameId}/${mode}`)
  }

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>
      <ThemeToggle />
      <MuteButton />

      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(circle at 50% 30%, ${game.cardColor}22, transparent 70%)` }} />

      <div className="relative z-10 flex flex-col h-full scrollable px-4 pb-6">
        <button
          onClick={() => { sfx.click(); navigate('/') }}
          className="mt-14 mb-2 self-start cartoon-btn px-4 py-2 text-sm font-display"
          style={{ background: 'var(--bg-card)', color: 'var(--text)' }}
        >
          ← Back
        </button>

        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center py-4">
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="text-6xl mb-3">
            {game.emoji}
          </motion.div>
          <h1 className="font-display text-4xl mb-1 theme-text" style={{ textShadow: `3px 3px 0 ${game.cardColor}` }}>
            {game.name}
          </h1>
          <p className="font-body text-sm mb-2 theme-muted">{game.description}</p>
          <div className="inline-block cartoon-card px-3 py-1 text-xs font-body theme-muted"
            style={{ background: 'var(--bg-card)' }}>
            {game.controlIcon} {game.controlType}
          </div>
        </motion.div>

        <div className="flex flex-col gap-3 max-w-sm mx-auto w-full">
          {Object.entries(MODE_INFO).map(([modeKey, modeInfo], i) => {
            const bestScore = scores[modeKey]
            return (
              <motion.button
                key={modeKey}
                initial={{ x: -30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => handleMode(modeKey)}
                className="cartoon-card p-4 text-left relative overflow-hidden"
                style={{ backgroundColor: modeInfo.bg, borderColor: modeInfo.color, boxShadow: `4px 4px 0px ${modeInfo.color}` }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">{modeInfo.emoji}</span>
                      <span className="font-display text-xl" style={{ color: modeInfo.color }}>{modeInfo.label}</span>
                    </div>
                    <p className="font-body text-gray-400 text-xs mb-2">{modeInfo.description}</p>
                    <div className="cartoon-card px-3 py-2 italic font-body text-sm"
                      style={{ backgroundColor: '#00000033', color: modeInfo.color }}>
                      "{game.modes[modeKey]?.desc}"
                    </div>
                  </div>
                </div>
                {bestScore > 0 && (
                  <div className="mt-2 text-xs font-body text-gray-500">
                    🏆 Best: <span className="text-white font-bold">{bestScore}{game.scoreUnit ? ` ${game.scoreUnit}` : ''}</span>
                  </div>
                )}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl opacity-40">▶</div>
              </motion.button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
