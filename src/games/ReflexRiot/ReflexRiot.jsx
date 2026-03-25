import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { GAME_MAP } from '../../data/games'
import { useLocalScore } from '../../hooks/useLocalScore'
import { randomBetween } from '../../utils/invertControl'
import { sfx, resumeCtx } from '../../audio/audioManager'
import GameHUD from '../../components/GameHUD'
import GameOverScreen from '../../components/GameOverScreen'
import CountdownOverlay from '../../components/CountdownOverlay'
import TraumaIndicator from '../../components/TraumaIndicator'
import ControlHint from '../../components/ControlHint'
import MuteButton from '../../components/MuteButton'

const DIRS = ['up', 'down', 'left', 'right']
const DIR_ARROW = { up: '↑', down: '↓', left: '←', right: '→' }
const DIR_OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' }

export default function ReflexRiot() {
  const { mode } = useParams()
  const game = GAME_MAP['reflex-riot']
  const { bestScore, isNewRecord, submitScore } = useLocalScore('reflex-riot', mode)
  const [phase, setPhase] = useState('countdown')
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [currentDir, setCurrentDir] = useState(null)
  const [timeLeft, setTimeLeft] = useState(1)
  const [result, setResult] = useState(null) // 'correct' | 'wrong'
  const [isInverted, setIsInverted] = useState(false)
  const [justFlipped, setJustFlipped] = useState(false)
  const invertedRef = useRef(false)
  const scoreRef = useRef(0)
  const livesRef = useRef(3)
  const frameRef = useRef(0)
  const currentDirRef = useRef(null)
  const traumaMatchRef = useRef(false) // In trauma: match or oppose?

  const getWindow = () => Math.max(600, 1400 - scoreRef.current * 20)

  const nextRound = useCallback(() => {
    const dir = DIRS[Math.floor(Math.random() * 4)]
    currentDirRef.current = dir
    setCurrentDir(dir)
    setTimeLeft(1)
    setResult(null)

    if (mode === 'trauma') {
      const match = Math.random() > 0.5
      traumaMatchRef.current = match
    }

    const deadline = setTimeout(() => {
      if (currentDirRef.current === dir) {
        livesRef.current = Math.max(0, livesRef.current - 1)
        setLives(livesRef.current)
        setResult('wrong')
        sfx.hit()
        if (livesRef.current <= 0) { submitScore(scoreRef.current); setPhase('dead'); return }
        setTimeout(nextRound, 600)
      }
    }, getWindow())

    // Timer animation
    const start = Date.now()
    const win = getWindow()
    const timerInterval = setInterval(() => {
      const elapsed = Date.now() - start
      setTimeLeft(Math.max(0, 1 - elapsed / win))
      if (elapsed >= win) clearInterval(timerInterval)
    }, 16)

    return () => { clearTimeout(deadline); clearInterval(timerInterval) }
  }, [mode, submitScore])

  const handleInput = useCallback((dir) => {
    if (phase !== 'playing' || !currentDirRef.current) return
    resumeCtx()
    const shown = currentDirRef.current
    let correct = false

    if (mode === 'normal') correct = dir === shown
    else if (mode === 'instinct') correct = dir === DIR_OPPOSITE[shown]
    else { // trauma
      correct = traumaMatchRef.current ? dir === shown : dir === DIR_OPPOSITE[shown]
    }

    currentDirRef.current = null
    if (correct) {
      scoreRef.current++; setScore(scoreRef.current); setResult('correct'); sfx.score()
    } else {
      livesRef.current = Math.max(0, livesRef.current - 1); setLives(livesRef.current)
      setResult('wrong'); sfx.hit()
      if (livesRef.current <= 0) { submitScore(scoreRef.current); setPhase('dead'); return }
    }
    setTimeout(nextRound, 400)
  }, [phase, mode, nextRound])

  useEffect(() => {
    const onKey = (e) => {
      const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }
      if (map[e.key]) handleInput(map[e.key])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleInput])

  // Trauma flip
  useEffect(() => {
    if (phase !== 'playing' || mode !== 'trauma') return
    const interval = setInterval(() => {
      invertedRef.current = !invertedRef.current
      setIsInverted(invertedRef.current); setJustFlipped(true)
      setTimeout(() => setJustFlipped(false), 500); sfx.flip()
    }, randomBetween(2000, 6000))
    return () => clearInterval(interval)
  }, [phase, mode])

  const startGame = () => {
    scoreRef.current = 0; livesRef.current = 3
    setScore(0); setLives(3); setIsInverted(false); invertedRef.current = false
    setPhase('playing')
    setTimeout(nextRound, 200)
  }

  const instructionText = () => {
    if (mode === 'normal') return 'Press the shown direction'
    if (mode === 'instinct') return 'Press the OPPOSITE direction'
    return traumaMatchRef.current ? '✅ Press SAME direction' : '❌ Press OPPOSITE direction'
  }

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-bg-dark" style={{ touchAction: 'none' }}>
      <MuteButton />
      {phase === 'playing' && (
        <>
          <GameHUD score={score} mode={mode} gameId="reflex-riot" scoreUnit="" />
          {mode === 'trauma' && <TraumaIndicator isInverted={isInverted} justFlipped={justFlipped} />}

          {/* Lives */}
          <div className="absolute top-14 left-3 flex gap-1">
            {[...Array(3)].map((_, i) => (
              <span key={i} className="text-2xl">{i < lives ? '❤️' : '🖤'}</span>
            ))}
          </div>

          <div className="flex flex-col items-center gap-6 w-full max-w-xs px-4">
            {/* Instruction */}
            <div className="cartoon-card px-4 py-2 bg-bg-card border-black text-center font-body text-sm text-gray-300">
              {instructionText()}
            </div>

            {/* Timer bar */}
            <div className="w-full h-3 rounded-full bg-gray-800 overflow-hidden border-2 border-black">
              <div className="h-full rounded-full transition-none"
                style={{
                  width: `${timeLeft * 100}%`,
                  backgroundColor: timeLeft > 0.5 ? '#55EFC4' : timeLeft > 0.25 ? '#FFE66D' : '#FF6B6B',
                }} />
            </div>

            {/* Arrow prompt */}
            <div
              className="w-40 h-40 cartoon-card flex items-center justify-center text-9xl font-display"
              style={{
                backgroundColor: result === 'correct' ? '#27ae60' : result === 'wrong' ? '#c0392b' : '#1A1A2E',
                borderColor: result === 'correct' ? '#27ae60' : result === 'wrong' ? '#e74c3c' : '#4a4a6a',
                color: '#fff',
                transition: 'background-color 0.15s',
              }}
            >
              {currentDir ? DIR_ARROW[currentDir] : '?'}
            </div>

            {/* Mobile direction buttons */}
            <div className="grid grid-cols-3 gap-2 w-full max-w-[220px]">
              {[['', 'up', ''], ['left', 'down', 'right']].flat().map((d, i) => (
                <button
                  key={i}
                  disabled={!d}
                  onClick={() => d && handleInput(d)}
                  className={`h-14 cartoon-btn text-2xl font-display ${d ? 'bg-bg-card text-white border-gray-600' : 'invisible'}`}
                >
                  {d ? DIR_ARROW[d] : ''}
                </button>
              ))}
            </div>
          </div>
          <ControlHint hint={game.desktopHint} />
        </>
      )}
      {phase === 'countdown' && <CountdownOverlay onDone={startGame} />}
      {phase === 'dead' && (
        <GameOverScreen score={score} bestScore={bestScore} isNewRecord={isNewRecord}
          scoreUnit="" mode={mode} gameId="reflex-riot"
          onRetry={() => setPhase('countdown')} />
      )}
    </div>
  )
}
