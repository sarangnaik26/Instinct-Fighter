import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { GAME_MAP } from '../../data/games'
import { useLocalScore } from '../../hooks/useLocalScore'
import { randomBetween } from '../../utils/invertControl'
import { sfx, resumeCtx } from '../../audio/audioManager'
import GameHUD from '../../components/GameHUD'
import GameOverScreen from '../../components/GameOverScreen'
import TraumaIndicator from '../../components/TraumaIndicator'
import ControlHint from '../../components/ControlHint'
import CountdownOverlay from '../../components/CountdownOverlay'
import MuteButton from '../../components/MuteButton'
import { motion } from 'framer-motion'

const GRAVITY = 0.12
const FLAP_FORCE = -5.8
const PIPE_W = 55
const GAP = 160
const PIPE_SPEED_INIT = 2.2
const BIRD_X = 80

export default function GravityFool() {
  const { mode } = useParams()
  const game = GAME_MAP['gravity-fool']
  const { bestScore, isNewRecord, submitScore } = useLocalScore('gravity-fool', mode)
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const animRef = useRef(null)
  const invertedRef = useRef(false)
  const scoreRef = useRef(0)
  const [phase, setPhase] = useState('countdown') // countdown | waiting | playing | dead
  const [score, setScore] = useState(0)
  const [isInverted, setIsInverted] = useState(false)
  const [justFlipped, setJustFlipped] = useState(false)

  const initState = (W, H) => ({
    bird: { y: H / 2, vy: 0, angle: 0 },
    pipes: [],
    frameCount: 0,
    speed: PIPE_SPEED_INIT,
    lastTraumaFlip: Date.now(),
    nextTraumaDelay: randomBetween(2500, 7000),
    W, H,
  })

  const flap = useCallback(() => {
    if (!stateRef.current) return
    resumeCtx()
    if (phase !== 'waiting' && phase !== 'playing') return
    if (phase === 'waiting') setPhase('playing')
    sfx.jump()
    const force = invertedRef.current ? -FLAP_FORCE : FLAP_FORCE
    stateRef.current.bird.vy = force
  }, [phase])

  useEffect(() => {
    const onKey = (e) => { if (e.code === 'Space') { e.preventDefault(); flap() } }
    const onClick = () => flap()
    window.addEventListener('keydown', onKey)
    window.addEventListener('click', onClick)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('click', onClick) }
  }, [flap])

  const startGame = useCallback(() => {
    scoreRef.current = 0; setScore(0); setIsInverted(false); invertedRef.current = false
    const c = canvasRef.current
    if (c) {
      stateRef.current = initState(c.offsetWidth, c.offsetHeight)
    }
    setPhase('countdown')
  }, [])

  useEffect(() => { startGame() }, [])

  // Draw loop — always runs to render "waiting" screen too
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    const loop = () => {
      const s = stateRef.current
      if (!s) { animRef.current = requestAnimationFrame(loop); return }
      const { W, H } = s
      const now = Date.now()

      if (phase === 'playing') {
        // Trauma flip
        if (mode === 'trauma') {
          if (now - s.lastTraumaFlip > s.nextTraumaDelay) {
            invertedRef.current = !invertedRef.current
            setIsInverted(invertedRef.current); setJustFlipped(true)
            setTimeout(() => setJustFlipped(false), 500); sfx.flip()
            s.lastTraumaFlip = now; s.nextTraumaDelay = randomBetween(2500, 7000)
          }
        } else { invertedRef.current = mode === 'instinct' }

        const inv = invertedRef.current
        const grav = inv ? -GRAVITY : GRAVITY

        s.bird.vy += grav
        s.bird.vy = Math.max(-10, Math.min(10, s.bird.vy))
        s.bird.y += s.bird.vy
        s.bird.angle = Math.max(-30, Math.min(85, s.bird.vy * 5))

        s.frameCount++
        if (s.frameCount % 140 === 0) {
          const topH = randomBetween(70, H - GAP - 70)
          s.pipes.push({ x: W + 20, topH, scored: false })
          s.speed = Math.min(PIPE_SPEED_INIT + s.frameCount / 700, 5.5)
        }

        s.pipes.forEach(p => p.x -= s.speed)
        s.pipes = s.pipes.filter(p => p.x > -PIPE_W - 10)

        s.pipes.forEach(p => {
          if (!p.scored && p.x + PIPE_W < BIRD_X) {
            p.scored = true; scoreRef.current++; setScore(scoreRef.current); sfx.collect()
          }
        })

        const birdR = 13
        const died =
          s.bird.y < birdR || s.bird.y > H - birdR ||
          s.pipes.some(p => {
            const inX = BIRD_X + birdR > p.x && BIRD_X - birdR < p.x + PIPE_W
            return inX && (s.bird.y - birdR < p.topH || s.bird.y + birdR > p.topH + GAP)
          })

        if (died) { sfx.gameOver(); submitScore(scoreRef.current); setPhase('dead'); cancelAnimationFrame(animRef.current); return }
      }

      // ---- DRAW ----
      ctx.clearRect(0, 0, W, H)

      const inv = invertedRef.current
      const sky = ctx.createLinearGradient(0, 0, 0, H)
      sky.addColorStop(0, inv ? '#1a1a3e' : '#87CEEB')
      sky.addColorStop(1, inv ? '#0a0a1e' : '#d0eeff')
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H)

      // Clouds
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ;[[60,55,s.frameCount*0.25],[200,35,s.frameCount*0.3],[360,65,s.frameCount*0.2]].forEach(([bx,by,off]) => {
        const cx = ((bx + off) % (W + 80)) - 40
        ctx.beginPath(); ctx.arc(cx, by, 24, 0, Math.PI*2); ctx.fill()
        ctx.beginPath(); ctx.arc(cx+28, by-8, 18, 0, Math.PI*2); ctx.fill()
        ctx.beginPath(); ctx.arc(cx-20, by+4, 14, 0, Math.PI*2); ctx.fill()
      })

      // Pipes
      s.pipes.forEach(p => {
        const pColor = inv ? '#6b2510' : '#2d9950'
        const capColor = inv ? '#9b3a18' : '#1f7a38'

        // Top pipe
        ctx.fillStyle = pColor
        ctx.beginPath(); ctx.roundRect(p.x, 0, PIPE_W, p.topH - 12, [0,0,4,4]); ctx.fill()
        ctx.fillStyle = capColor
        ctx.beginPath(); ctx.roundRect(p.x - 6, p.topH - 22, PIPE_W + 12, 22, 6); ctx.fill()
        ctx.strokeStyle = '#00000066'; ctx.lineWidth = 3
        ctx.beginPath(); ctx.roundRect(p.x, 0, PIPE_W, p.topH - 12, [0,0,4,4]); ctx.stroke()
        ctx.beginPath(); ctx.roundRect(p.x - 6, p.topH - 22, PIPE_W + 12, 22, 6); ctx.stroke()

        // Bottom pipe
        const botY = p.topH + GAP
        ctx.fillStyle = pColor
        ctx.beginPath(); ctx.roundRect(p.x, botY + 12, PIPE_W, H - botY, [4,4,0,0]); ctx.fill()
        ctx.fillStyle = capColor
        ctx.beginPath(); ctx.roundRect(p.x - 6, botY, PIPE_W + 12, 22, 6); ctx.fill()
        ctx.strokeStyle = '#00000066'; ctx.lineWidth = 3
        ctx.beginPath(); ctx.roundRect(p.x, botY + 12, PIPE_W, H - botY, [4,4,0,0]); ctx.stroke()
        ctx.beginPath(); ctx.roundRect(p.x - 6, botY, PIPE_W + 12, 22, 6); ctx.stroke()
      })

      // Ground
      ctx.fillStyle = '#8B6914'; ctx.fillRect(0, H - 22, W, 22)
      ctx.fillStyle = '#6B8E23'; ctx.fillRect(0, H - 26, W, 8)
      ctx.strokeStyle = '#00000066'; ctx.lineWidth = 2; ctx.strokeRect(0, H - 26, W, 26)

      // Bird
      ctx.save()
      ctx.translate(BIRD_X, s.bird.y)
      ctx.rotate((s.bird.angle * Math.PI) / 180)
      const wingBob = Math.sin(s.frameCount * 0.35) > 0
      ctx.fillStyle = inv ? '#FF6B6B' : '#FFE66D'
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2.5
      ctx.beginPath(); ctx.ellipse(0, 0, 17, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      ctx.fillStyle = inv ? '#FF4444' : '#FFC200'
      ctx.beginPath(); ctx.ellipse(-3, wingBob ? 5 : 2, 10, 5, wingBob ? -0.5 : 0.1, 0, Math.PI * 2)
      ctx.fill(); ctx.stroke()
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(7, -4, 5, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(8, -4, 3, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(9, -5, 1, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#FF8C00'
      ctx.beginPath(); ctx.moveTo(14,-1); ctx.lineTo(21,2); ctx.lineTo(14,5); ctx.closePath()
      ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke()
      ctx.restore()

      // Waiting overlay
      if (phase === 'waiting') {
        ctx.fillStyle = 'rgba(0,0,0,0.45)'
        ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = '#fff'; ctx.font = 'bold 28px Fredoka One'; ctx.textAlign = 'center'
        ctx.fillText('Tap to Start!', W/2, H/2 - 16)
        ctx.font = '18px Nunito'; ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.fillText(game.desktopHint, W/2, H/2 + 18)
      }

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
    <div className="relative w-full h-full bg-black" style={{ touchAction: 'none' }}
      onTouchStart={(e) => { e.preventDefault(); flap() }}>
      <canvas ref={canvasRef} className="w-full h-full" />
      <MuteButton />
      {(phase === 'playing' || phase === 'waiting') && (
        <>
          <GameHUD score={score} mode={mode} gameId="gravity-fool" scoreUnit="" />
          {mode === 'trauma' && phase === 'playing' && <TraumaIndicator isInverted={isInverted} justFlipped={justFlipped} />}
        </>
      )}
      {phase === 'countdown' && <CountdownOverlay onDone={() => setPhase('waiting')} />}
      {phase === 'dead' && (
        <GameOverScreen score={score} bestScore={bestScore} isNewRecord={isNewRecord}
          scoreUnit="" mode={mode} gameId="gravity-fool" onRetry={startGame} />
      )}
    </div>
  )
}
