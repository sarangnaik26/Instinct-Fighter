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

const GRAVITY = 0.20
const FLAP_FORCE = -4.6
const PIPE_W = 55
const GAP = 150
const PIPE_SPEED_INIT = 2.4
const BIRD_X = 80

const spritePaths = {
  bird: import.meta.env.BASE_URL + 'assets/sprites/Blue Bird Front.png',
  wood: import.meta.env.BASE_URL + 'assets/sprites/Wood.png',
  bg: import.meta.env.BASE_URL + 'assets/sprites/background.png',
}
const sprites = {}
Object.keys(spritePaths).forEach(key => {
  const img = new Image()
  img.src = spritePaths[key]
  sprites[key] = img
})

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
        s.bird.vy = Math.max(-8, Math.min(6.5, s.bird.vy))
        s.bird.y += s.bird.vy
        
        const absVy = inv ? -s.bird.vy : s.bird.vy
        if (absVy < -0.5) {
          s.bird.angle = inv ? 25 : -25
        } else if (absVy < 3.5) {
          s.bird.angle += inv ? -1.5 : 1.5
        } else {
          s.bird.angle += inv ? -6 : 6
        }
        s.bird.angle = Math.max(-90, Math.min(90, s.bird.angle))

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
      ctx.filter = inv ? 'hue-rotate(180deg) invert(80%)' : 'none'

      // Parallax Background
      if (sprites.bg.complete && sprites.bg.naturalHeight !== 0) {
        const bgRatio = sprites.bg.width / sprites.bg.height
        const bgW = H * bgRatio
        const shiftX = (s.frameCount * 0.5) % bgW
        
        // Draw enough tiles to safely cover any ultra-wide screen
        const tilesNeeded = Math.ceil(W / bgW) + 1
        for (let i = 0; i < tilesNeeded; i++) {
          ctx.drawImage(sprites.bg, Math.floor(-shiftX + (i * bgW)), 0, Math.ceil(bgW) + 1, H)
        }
      } else {
        ctx.fillStyle = '#87CEEB'; ctx.fillRect(0, 0, W, H)
      }

      // Pipes
      s.pipes.forEach(p => {
        const woodReady = sprites.wood.complete && sprites.wood.naturalHeight !== 0

        // Top pipe
        if (woodReady) {
          ctx.drawImage(sprites.wood, p.x, 0, PIPE_W, p.topH - 12)
          ctx.drawImage(sprites.wood, p.x - 6, p.topH - 22, PIPE_W + 12, 22)
        } else {
          ctx.fillStyle = '#2d9950'
          ctx.beginPath(); ctx.roundRect(p.x, 0, PIPE_W, p.topH - 12, [0,0,4,4]); ctx.fill()
          ctx.fillStyle = '#1f7a38'
          ctx.beginPath(); ctx.roundRect(p.x - 6, p.topH - 22, PIPE_W + 12, 22, 6); ctx.fill()
          ctx.strokeStyle = '#00000066'; ctx.lineWidth = 3
          ctx.beginPath(); ctx.roundRect(p.x, 0, PIPE_W, p.topH - 12, [0,0,4,4]); ctx.stroke()
          ctx.beginPath(); ctx.roundRect(p.x - 6, p.topH - 22, PIPE_W + 12, 22, 6); ctx.stroke()
        }

        // Bottom pipe
        const botY = p.topH + GAP
        if (woodReady) {
          ctx.drawImage(sprites.wood, p.x, botY + 12, PIPE_W, H - botY)
          ctx.drawImage(sprites.wood, p.x - 6, botY, PIPE_W + 12, 22)
        } else {
          ctx.fillStyle = '#2d9950'
          ctx.beginPath(); ctx.roundRect(p.x, botY + 12, PIPE_W, H - botY, [4,4,0,0]); ctx.fill()
          ctx.fillStyle = '#1f7a38'
          ctx.beginPath(); ctx.roundRect(p.x - 6, botY, PIPE_W + 12, 22, 6); ctx.fill()
          ctx.strokeStyle = '#00000066'; ctx.lineWidth = 3
          ctx.beginPath(); ctx.roundRect(p.x, botY + 12, PIPE_W, H - botY, [4,4,0,0]); ctx.stroke()
          ctx.beginPath(); ctx.roundRect(p.x - 6, botY, PIPE_W + 12, 22, 6); ctx.stroke()
        }
      })

      // Ground
      ctx.fillStyle = '#8B6914'; ctx.fillRect(0, H - 22, W, 22)
      ctx.fillStyle = '#6B8E23'; ctx.fillRect(0, H - 26, W, 8)
      ctx.strokeStyle = '#00000066'; ctx.lineWidth = 2; ctx.strokeRect(0, H - 26, W, 26)

      // Ceiling (Top Ground)
      ctx.fillStyle = '#8B6914'; ctx.fillRect(0, 0, W, 22)
      ctx.fillStyle = '#6B8E23'; ctx.fillRect(0, 18, W, 8)
      ctx.strokeStyle = '#00000066'; ctx.lineWidth = 2; ctx.strokeRect(0, 0, W, 26)

      // Bird
      ctx.save()
      ctx.translate(BIRD_X, s.bird.y)
      ctx.rotate((s.bird.angle * Math.PI) / 180)
      
      const birdSize = 38
      if (sprites.bird.complete && sprites.bird.naturalHeight !== 0) {
        const numFrames = Math.max(1, Math.round(sprites.bird.width / Math.max(1, sprites.bird.height)))
        const frameW = sprites.bird.width / numFrames
        
        let curFrame = 0
        const absVy = inv ? -s.bird.vy : s.bird.vy
        if (absVy < 3.5) {
          curFrame = Math.floor(s.frameCount / 6) % numFrames
        }

        ctx.drawImage(sprites.bird, curFrame * frameW, 0, frameW, sprites.bird.height, -birdSize / 2, -birdSize / 2, birdSize, birdSize)
      } else {
        const wingBob = Math.sin(s.frameCount * 0.35) > 0
        ctx.fillStyle = '#FFE66D'
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2.5
        ctx.beginPath(); ctx.ellipse(0, 0, 17, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
        ctx.fillStyle = '#FFC200'
        ctx.beginPath(); ctx.ellipse(-3, wingBob ? 5 : 2, 10, 5, wingBob ? -0.5 : 0.1, 0, Math.PI * 2)
        ctx.fill(); ctx.stroke()
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(7, -4, 5, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(8, -4, 3, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(9, -5, 1, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#FF8C00'
        ctx.beginPath(); ctx.moveTo(14,-1); ctx.lineTo(21,2); ctx.lineTo(14,5); ctx.closePath()
        ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke()
      }
      ctx.restore()

      ctx.filter = 'none'

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
