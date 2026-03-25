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

const GAME_DURATION = 30

// 3 target types: fast=3pts, medium=2pts, slow=1pt
const TARGET_TYPES = [
  { key: 'fast',   color: '#FF6B6B', ring: '#FF4444', lifetime: 1200, pts: 3, r: 20, label: '3' },
  { key: 'medium', color: '#FFE66D', ring: '#FFC200', lifetime: 2000, pts: 2, r: 26, label: '2' },
  { key: 'slow',   color: '#55EFC4', ring: '#00b894', lifetime: 3200, pts: 1, r: 32, label: '1' },
]
const MAX_TARGETS = 4

export default function TargetPanic() {
  const { mode } = useParams()
  const game = GAME_MAP['target-panic']
  const { bestScore, isNewRecord, submitScore } = useLocalScore('target-panic', mode)
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const animRef = useRef(null)
  const cursorRef = useRef({ x: 0, y: 0 })
  const realCursorRef = useRef({ x: 0, y: 0 })
  const invertedRef = useRef(false)
  const scoreRef = useRef(0)
  const [phase, setPhase] = useState('countdown')
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [isInverted, setIsInverted] = useState(false)
  const [justFlipped, setJustFlipped] = useState(false)

  const initState = (W, H) => ({
    targets: [], frameCount: 0, lastSpawn: 0,
    popEffects: [], // { x, y, pts, born }
    lastTraumaFlip: Date.now(), nextTraumaDelay: randomBetween(2500, 7000),
    W, H,
  })

  const trySpawn = (s) => {
    const { W, H } = s
    const active = s.targets.filter(t => !t.hit).length
    if (active >= MAX_TARGETS) return
    if (Date.now() - s.lastSpawn < 600) return

    // Weight spawn toward fast targets to keep it exciting
    const r = Math.random()
    const tType = r < 0.4 ? TARGET_TYPES[0] : r < 0.72 ? TARGET_TYPES[1] : TARGET_TYPES[2]
    s.targets.push({
      x: randomBetween(tType.r + 20, W - tType.r - 20),
      y: randomBetween(tType.r + 70, H - tType.r - 30),
      ...tType,
      born: Date.now(),
      hit: false,
    })
    s.lastSpawn = Date.now()
  }

  const handleShoot = useCallback(() => {
    if (phase !== 'playing') return
    resumeCtx()
    const s = stateRef.current
    if (!s) return
    const cx = cursorRef.current.x, cy = cursorRef.current.y
    let hitAny = false
    s.targets.forEach(t => {
      if (!t.hit && Math.hypot(cx - t.x, cy - t.y) < t.r + 6) {
        t.hit = true; hitAny = true
        scoreRef.current += t.pts; setScore(scoreRef.current)
        s.popEffects.push({ x: t.x, y: t.y, pts: t.pts, born: Date.now(), color: t.color })
        sfx.score()
      }
    })
    if (!hitAny) sfx.hit()
  }, [phase])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onMM = (e) => {
      const rect = canvas.getBoundingClientRect()
      realCursorRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    const onClick = () => handleShoot()
    const onTouch = (e) => { e.preventDefault(); handleShoot() }
    window.addEventListener('mousemove', onMM)
    canvas.addEventListener('click', onClick)
    canvas.addEventListener('touchstart', onTouch, { passive: false })
    return () => {
      window.removeEventListener('mousemove', onMM)
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('touchstart', onTouch)
    }
  }, [handleShoot])

  const startGame = useCallback(() => {
    const c = canvasRef.current
    scoreRef.current = 0; setScore(0); setTimeLeft(GAME_DURATION)
    setIsInverted(false); invertedRef.current = false
    stateRef.current = initState(c.offsetWidth, c.offsetHeight)
    cursorRef.current = { x: c.offsetWidth/2, y: c.offsetHeight/2 }
    realCursorRef.current = { x: c.offsetWidth/2, y: c.offsetHeight/2 }
    setPhase('playing')
  }, [])

  useEffect(() => {
    if (phase !== 'playing') return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const startTime = Date.now()

    const loop = () => {
      const s = stateRef.current
      const { W, H } = s
      const now = Date.now()
      const elapsed = (now - startTime) / 1000

      if (elapsed >= GAME_DURATION) {
        sfx.gameOver(); submitScore(scoreRef.current); setPhase('dead'); return
      }
      setTimeLeft(Math.max(0, Math.ceil(GAME_DURATION - elapsed)))

      if (mode === 'trauma') {
        if (now - s.lastTraumaFlip > s.nextTraumaDelay) {
          invertedRef.current = !invertedRef.current
          setIsInverted(invertedRef.current); setJustFlipped(true)
          setTimeout(() => setJustFlipped(false), 500); sfx.flip()
          s.lastTraumaFlip = now; s.nextTraumaDelay = randomBetween(2500, 7000)
        }
      } else invertedRef.current = mode === 'instinct'

      s.frameCount++

      // Update cursor
      const inv = invertedRef.current
      const real = realCursorRef.current
      cursorRef.current = inv ? { x: W - real.x, y: H - real.y } : { x: real.x, y: real.y }

      // Remove expired and hit targets
      s.targets = s.targets.filter(t => !t.hit && now - t.born < t.lifetime)
      trySpawn(s)

      // Cleanup pop effects
      s.popEffects = s.popEffects.filter(p => now - p.born < 700)

      // ---- DRAW ----
      ctx.clearRect(0, 0, W, H)
      const bg = ctx.createLinearGradient(0,0,0,H)
      bg.addColorStop(0,'#1a1a2e'); bg.addColorStop(1,'#0d1117')
      ctx.fillStyle=bg; ctx.fillRect(0,0,W,H)

      // Legend top-right
      TARGET_TYPES.forEach((tt, i) => {
        const lx = W - 110, ly = 52 + i * 24
        ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.roundRect(lx-4,ly-14,100,20,4); ctx.fill()
        ctx.fillStyle=tt.color; ctx.beginPath(); ctx.arc(lx+8, ly-4, 7, 0, Math.PI*2); ctx.fill()
        ctx.fillStyle='#fff'; ctx.font='12px Nunito'; ctx.textAlign='left'
        ctx.fillText(`${tt.key} = ${tt.pts}pt — ${(tt.lifetime/1000).toFixed(1)}s`, lx+20, ly)
      })

      // Targets
      s.targets.forEach(t => {
        const age = (now - t.born) / t.lifetime
        const alpha = age > 0.75 ? 1 - (age - 0.75) / 0.25 : 1
        const pulse = 1 + Math.sin(s.frameCount * 0.18) * 0.05

        ctx.globalAlpha = Math.max(0.1, alpha)
        // Outer ring pulse
        ctx.strokeStyle = t.ring; ctx.lineWidth = 2.5
        ctx.beginPath(); ctx.arc(t.x, t.y, t.r * pulse + 10, 0, Math.PI*2); ctx.stroke()
        // Main
        ctx.fillStyle = t.color; ctx.strokeStyle='#000'; ctx.lineWidth=3
        ctx.beginPath(); ctx.arc(t.x, t.y, t.r * pulse, 0, Math.PI*2); ctx.fill(); ctx.stroke()
        // Inner white dot
        ctx.fillStyle='#fff'
        ctx.beginPath(); ctx.arc(t.x, t.y, t.r*0.3, 0, Math.PI*2); ctx.fill()
        // Points label
        ctx.fillStyle='#fff'; ctx.font=`bold ${t.r*0.75}px Fredoka One`; ctx.textAlign='center'; ctx.textBaseline='middle'
        ctx.fillText(t.label, t.x, t.y)
        ctx.textBaseline='alphabetic'

        // Countdown ring (shrinks as time runs out)
        ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.lineWidth=3
        ctx.beginPath(); ctx.arc(t.x, t.y, t.r+14, -Math.PI/2, -Math.PI/2 + (1-age)*Math.PI*2); ctx.stroke()

        ctx.globalAlpha = 1
      })

      // Pop effects (pts floating up)
      s.popEffects.forEach(p => {
        const age = (now - p.born) / 700
        const oy = age * 40
        ctx.globalAlpha = 1 - age
        ctx.fillStyle = p.color; ctx.font = `bold 22px Fredoka One`; ctx.textAlign = 'center'
        ctx.fillText(`+${p.pts}`, p.x, p.y - oy)
        ctx.globalAlpha = 1
      })

      // Timer bar
      const frac = 1 - elapsed / GAME_DURATION
      ctx.fillStyle = '#222'; ctx.fillRect(0, H-8, W, 8)
      ctx.fillStyle = frac > 0.35 ? '#55EFC4' : frac > 0.15 ? '#FFE66D' : '#FF6B6B'
      ctx.fillRect(0, H-8, W * frac, 8)

      // Custom cursor
      const cx2 = cursorRef.current.x, cy2 = cursorRef.current.y
      ctx.strokeStyle = inv ? '#FF6B6B' : '#fff'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(cx2-14,cy2); ctx.lineTo(cx2+14,cy2); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx2,cy2-14); ctx.lineTo(cx2,cy2+14); ctx.stroke()
      ctx.beginPath(); ctx.arc(cx2,cy2,5,0,Math.PI*2); ctx.stroke()

      // Score display
      ctx.fillStyle='rgba(0,0,0,0.55)'
      ctx.beginPath(); ctx.roundRect(W/2-50, H-42, 100, 30, 8); ctx.fill()
      ctx.fillStyle='#FFE66D'; ctx.font='bold 18px Fredoka One'; ctx.textAlign='center'
      ctx.fillText(`${scoreRef.current} pts`, W/2, H-22)

      animRef.current = requestAnimationFrame(loop)
    }
    animRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animRef.current)
  }, [phase, mode])

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
    <div className="relative w-full h-full bg-black" style={{ cursor: 'none', touchAction: 'none' }}>
      <canvas ref={canvasRef} className="w-full h-full" />
      <MuteButton />
      {phase === 'playing' && (
        <>
          <GameHUD score={score} mode={mode} gameId="target-panic" scoreUnit="pts" />
          <div className="absolute top-14 right-3 cartoon-card px-3 py-1 bg-black/60 border-white/30 font-display text-white text-sm">
            ⏱ {timeLeft}s
          </div>
          {mode === 'trauma' && <TraumaIndicator isInverted={isInverted} justFlipped={justFlipped} />}
          <ControlHint hint={game.desktopHint} />
        </>
      )}
      {phase === 'countdown' && <CountdownOverlay onDone={startGame} />}
      {phase === 'dead' && (
        <GameOverScreen score={score} bestScore={bestScore} isNewRecord={isNewRecord}
          scoreUnit="pts" mode={mode} gameId="target-panic" onRetry={() => setPhase('countdown')} />
      )}
    </div>
  )
}
