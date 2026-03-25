import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { GAME_MAP } from '../../data/games'
import { useLocalScore } from '../../hooks/useLocalScore'
import { invertDirection, randomBetween } from '../../utils/invertControl'
import { sfx, resumeCtx } from '../../audio/audioManager'
import GameHUD from '../../components/GameHUD'
import GameOverScreen from '../../components/GameOverScreen'
import CountdownOverlay from '../../components/CountdownOverlay'
import TraumaIndicator from '../../components/TraumaIndicator'
import ControlHint from '../../components/ControlHint'
import MuteButton from '../../components/MuteButton'

const LANES = 3

export default function DodgeAll() {
  const { mode } = useParams()
  const game = GAME_MAP['dodge-all']
  const { bestScore, isNewRecord, submitScore } = useLocalScore('dodge-all', mode)
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const animRef = useRef(null)
  const invertedRef = useRef(false)
  const scoreRef = useRef(0)
  const [phase, setPhase] = useState('countdown')
  const [score, setScore] = useState(0)
  const [isInverted, setIsInverted] = useState(false)
  const [justFlipped, setJustFlipped] = useState(false)

  const getLaneX = (lane, W) => (W / LANES) * lane + W / (LANES * 2)

  const initState = (W, H) => ({
    lane: 1, targetLane: 1, laneX: getLaneX(1, W),
    isJumping: false, jumpVY: 0, charY: 0, isDucking: false,
    obstacles: [], frameCount: 0, speed: 5,
    combo: 0, lastTraumaFlip: Date.now(), nextTraumaDelay: randomBetween(2000, 6000),
    W, H,
  })

  const doAction = useCallback((dir) => {
    if (!stateRef.current || phase !== 'playing') return
    resumeCtx()
    const raw = invertDirection(dir, invertedRef.current)
    const s = stateRef.current
    if (raw === 'left' && s.targetLane > 0) { s.targetLane--; sfx.jump() }
    else if (raw === 'right' && s.targetLane < 2) { s.targetLane++; sfx.jump() }
    else if (raw === 'up' && !s.isJumping) { s.isJumping = true; s.jumpVY = -14; sfx.jump() }
    else if (raw === 'down') { s.isDucking = true; setTimeout(() => { if (s) s.isDucking = false }, 600) }
  }, [phase])

  useEffect(() => {
    let startX = 0, startY = 0
    const onKey = (e) => {
      const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', ' ': 'up' }
      if (map[e.key]) { e.preventDefault(); doAction(map[e.key]) }
    }
    const onTS = (e) => { startX = e.touches[0].clientX; startY = e.touches[0].clientY }
    const onTE = (e) => {
      const dx = e.changedTouches[0].clientX - startX
      const dy = e.changedTouches[0].clientY - startY
      if (Math.abs(dx) > Math.abs(dy)) doAction(dx > 0 ? 'right' : 'left')
      else doAction(dy > 0 ? 'down' : 'up')
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('touchstart', onTS, { passive: true })
    window.addEventListener('touchend', onTE, { passive: true })
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('touchstart', onTS)
      window.removeEventListener('touchend', onTE)
    }
  }, [doAction])

  const startGame = () => {
    const c = canvasRef.current
    scoreRef.current = 0; setScore(0); setIsInverted(false); invertedRef.current = false
    stateRef.current = initState(c.offsetWidth, c.offsetHeight)
    setPhase('playing')
  }

  useEffect(() => {
    if (phase !== 'playing') return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    const loop = () => {
      const s = stateRef.current
      const { W, H } = s
      const now = Date.now()
      const groundY = H - 30

      if (mode === 'trauma') {
        if (now - s.lastTraumaFlip > s.nextTraumaDelay) {
          invertedRef.current = !invertedRef.current
          setIsInverted(invertedRef.current); setJustFlipped(true)
          setTimeout(() => setJustFlipped(false), 500); sfx.flip()
          s.lastTraumaFlip = now; s.nextTraumaDelay = randomBetween(2000, 6000)
        }
      } else invertedRef.current = mode === 'instinct'

      // Char movement
      s.laneX += (getLaneX(s.targetLane, W) - s.laneX) * 0.15
      if (s.isJumping) {
        s.charY += s.jumpVY; s.jumpVY += 0.7
        if (s.charY >= 0) { s.charY = 0; s.isJumping = false; s.jumpVY = 0 }
      }

      // Spawn
      s.frameCount++
      s.speed = Math.min(5 + s.frameCount / 400, 11)
      if (s.frameCount % 60 === 0) {
        const r = Math.random()
        const lane = Math.floor(Math.random() * LANES)
        s.obstacles.push({
          lane, y: -40,
          type: r < 0.33 ? 'high' : r < 0.66 ? 'low' : 'side',
          subType: lane
        })
      }

      s.obstacles.forEach(o => o.y += s.speed)
      s.obstacles = s.obstacles.filter(o => o.y < H + 60)

      scoreRef.current = Math.floor(s.frameCount / 10)
      setScore(scoreRef.current)

      const charX = s.laneX, charY = groundY - 60 + s.charY
      const duck = s.isDucking

      const died = s.obstacles.some(o => {
        const ox = getLaneX(o.lane, W)
        const sameLane = Math.abs(ox - charX) < 30
        if (!sameLane) return false
        if (o.type === 'high') return Math.abs(o.y - (charY - 20)) < 30 && !s.isJumping
        if (o.type === 'low') return Math.abs(o.y - charY) < 30 && !duck
        return Math.abs(o.y - charY) < 40
      })

      if (died) { sfx.gameOver(); submitScore(scoreRef.current); setPhase('dead'); return }

      // Draw
      ctx.clearRect(0, 0, W, H)
      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, '#0d1117'); bg.addColorStop(1, '#1a2332')
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

      for (let l = 0; l <= LANES; l++) {
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo((W / LANES) * l, 0); ctx.lineTo((W / LANES) * l, H); ctx.stroke()
      }

      ctx.fillStyle = '#2c1810'; ctx.fillRect(0, groundY, W, H - groundY)
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(0, groundY, W, H - groundY)

      s.obstacles.forEach(o => {
        const ox = getLaneX(o.lane, W)
        if (o.type === 'high') {
          ctx.fillStyle = '#8E44AD'
          ctx.beginPath(); ctx.arc(ox, o.y, 20, 0, Math.PI * 2); ctx.fill()
          ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.stroke()
          ctx.fillStyle = '#F39C12'
          ctx.font = 'bold 16px Fredoka One'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText('↑', ox, o.y)
        } else if (o.type === 'low') {
          ctx.fillStyle = '#E74C3C'
          ctx.fillRect(ox - 28, o.y, 56, 18)
          ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeRect(ox - 28, o.y, 56, 18)
        } else {
          ctx.fillStyle = '#E67E22'
          ctx.fillRect(ox - 20, o.y - 20, 40, 40)
          ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeRect(ox - 20, o.y - 20, 40, 40)
        }
      })

      // Character
      const cx = s.laneX, cy = groundY - 30 + s.charY
      const duckScale = duck ? 0.5 : 1
      ctx.save(); ctx.translate(cx, cy); ctx.scale(1, duckScale)
      ctx.fillStyle = '#4ECDC4'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3
      ctx.beginPath(); ctx.roundRect(-16, -28, 32, 36, 8); ctx.fill(); ctx.stroke()
      ctx.fillStyle = '#FFE66D'
      ctx.beginPath(); ctx.arc(0, -46, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-6, -48, 3, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(6, -48, 3, 0, Math.PI * 2); ctx.fill()
      const legSwing = Math.sin(s.frameCount * 0.4) * 10
      ctx.strokeStyle = '#000'; ctx.lineWidth = 5
      ctx.beginPath(); ctx.moveTo(-6, 8); ctx.lineTo(-6 - legSwing, 26); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(6, 8); ctx.lineTo(6 + legSwing, 26); ctx.stroke()
      ctx.restore()

      animRef.current = requestAnimationFrame(loop)
    }
    animRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animRef.current)
  }, [phase])

  useEffect(() => {
    const resize = () => {
      const c = canvasRef.current; if (!c) return
      c.width = c.offsetWidth; c.height = c.offsetHeight
      if (stateRef.current) { stateRef.current.W = c.width; stateRef.current.H = c.height }
    }
    resize(); window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  return (
    <div className="relative w-full h-full bg-black" style={{ touchAction: 'none' }}>
      <canvas ref={canvasRef} className="w-full h-full" />
      <MuteButton />
      {phase === 'playing' && (
        <>
          <GameHUD score={score} mode={mode} gameId="dodge-all" scoreUnit={game.scoreUnit} />
          {mode === 'trauma' && <TraumaIndicator isInverted={isInverted} justFlipped={justFlipped} />}
          <ControlHint hint={game.desktopHint} />
        </>
      )}
      {phase === 'countdown' && <CountdownOverlay onDone={startGame} />}
      {phase === 'dead' && (
        <GameOverScreen score={score} bestScore={bestScore} isNewRecord={isNewRecord}
          scoreUnit={game.scoreUnit} mode={mode} gameId="dodge-all"
          onRetry={() => setPhase('countdown')} />
      )}
    </div>
  )
}
