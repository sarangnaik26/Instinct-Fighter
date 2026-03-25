import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { GAME_MAP } from '../../data/games'
import { useLocalScore } from '../../hooks/useLocalScore'
import { invertAxis, randomBetween } from '../../utils/invertControl'
import { sfx, resumeCtx } from '../../audio/audioManager'
import GameHUD from '../../components/GameHUD'
import GameOverScreen from '../../components/GameOverScreen'
import CountdownOverlay from '../../components/CountdownOverlay'
import TraumaIndicator from '../../components/TraumaIndicator'
import ControlHint from '../../components/ControlHint'
import MuteButton from '../../components/MuteButton'
import { isMobileDevice } from '../../utils/deviceDetect'

export default function GyroPilot() {
  const { mode } = useParams()
  const game = GAME_MAP['gyro-pilot']
  const { bestScore, isNewRecord, submitScore } = useLocalScore('gyro-pilot', mode)
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const animRef = useRef(null)
  const invertedRef = useRef(false)
  const inputRef = useRef({ x: 0, y: 0 })
  const scoreRef = useRef(0)
  const [phase, setPhase] = useState('countdown')
  const [score, setScore] = useState(0)
  const [isInverted, setIsInverted] = useState(false)
  const [justFlipped, setJustFlipped] = useState(false)

  // Walls: each has x (scroll position), and topH/botY that VARY
  const generateWalls = (W, H) => {
    const walls = []
    let gapCenter = H / 2
    for (let i = 0; i < 20; i++) {
      // Each gap moves significantly from the last
      gapCenter += randomBetween(-H * 0.28, H * 0.28)
      gapCenter = Math.max(H * 0.22, Math.min(H * 0.78, gapCenter))
      const gapSize = randomBetween(H * 0.38, H * 0.46)
      walls.push({
        x: W + 300 + i * 260,
        topH: gapCenter - gapSize / 2,
        botY: gapCenter + gapSize / 2,
      })
    }
    return walls
  }

  const initState = (W, H) => ({
    shipX: W * 0.25, shipY: H / 2,
    walls: generateWalls(W, H),
    wallOffset: 0, speed: 1.8, frameCount: 0, survived: 0,
    lastTraumaFlip: Date.now(), nextTraumaDelay: randomBetween(2500, 7000),
    lastGapCenter: H / 2, W, H,
  })

  useEffect(() => {
    if (isMobileDevice()) {
      const onOrient = (e) => {
        inputRef.current = {
          x: Math.max(-1, Math.min(1, (e.gamma || 0) / 40)),
          y: Math.max(-1, Math.min(1, (e.beta || 0) / 40)),
        }
      }
      window.addEventListener('deviceorientation', onOrient)
      return () => window.removeEventListener('deviceorientation', onOrient)
    } else {
      const keys = {}
      const onKey = (e) => { keys[e.key] = true }
      const onKeyUp = (e) => { keys[e.key] = false }
      const onMouse = (e) => {
        inputRef.current = {
          x: Math.max(-1, Math.min(1, (e.clientX / window.innerWidth - 0.5) * 2.2)),
          y: Math.max(-1, Math.min(1, (e.clientY / window.innerHeight - 0.5) * 2.2)),
        }
      }
      const tick = setInterval(() => {
        const kx = (keys['d']||keys['ArrowRight']?1:0)-(keys['a']||keys['ArrowLeft']?1:0)
        const ky = (keys['s']||keys['ArrowDown']?1:0)-(keys['w']||keys['ArrowUp']?1:0)
        if (kx!==0||ky!==0) inputRef.current = { x:kx, y:ky }
      }, 16)
      window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKeyUp)
      window.addEventListener('mousemove', onMouse)
      return () => {
        window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp)
        window.removeEventListener('mousemove', onMouse); clearInterval(tick)
      }
    }
  }, [])

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

      if (mode === 'trauma') {
        if (now - s.lastTraumaFlip > s.nextTraumaDelay) {
          invertedRef.current = !invertedRef.current
          setIsInverted(invertedRef.current); setJustFlipped(true)
          setTimeout(() => setJustFlipped(false), 500); sfx.flip()
          s.lastTraumaFlip = now; s.nextTraumaDelay = randomBetween(2500, 7000)
        }
      } else invertedRef.current = mode === 'instinct'

      s.frameCount++
      s.speed = Math.min(1.8 + s.frameCount / 500, 5)
      s.wallOffset += s.speed
      s.survived = Math.floor(s.frameCount / 60)
      scoreRef.current = s.survived; setScore(s.survived)

      const ix = invertAxis(inputRef.current.x, invertedRef.current)
      const iy = invertAxis(inputRef.current.y, invertedRef.current)
      s.shipX += ix * 3.5; s.shipY += iy * 3.5
      s.shipX = Math.max(22, Math.min(W - 22, s.shipX))
      s.shipY = Math.max(22, Math.min(H - 22, s.shipY))

      // Extend walls — each new gap jumps significantly
      const lastWall = s.walls[s.walls.length - 1]
      if (lastWall.x - s.wallOffset < W + 200) {
        let gc = s.lastGapCenter
        gc += randomBetween(-H * 0.3, H * 0.3)
        gc = Math.max(H * 0.22, Math.min(H * 0.78, gc))
        s.lastGapCenter = gc
        const gapSize = Math.max(H * 0.26 - s.frameCount * 0.005, H * 0.2)
        s.walls.push({
          x: lastWall.x + 260,
          topH: gc - gapSize / 2,
          botY: gc + gapSize / 2,
        })
      }
      s.walls = s.walls.filter(w => w.x - s.wallOffset > -80)

      const died = s.shipY <= 8 || s.shipY >= H - 8 ||
        s.walls.some(w => {
          const wx = w.x - s.wallOffset
          return Math.abs(wx - s.shipX) < 36 && (s.shipY < w.topH || s.shipY > w.botY)
        })

      if (died) { sfx.gameOver(); submitScore(scoreRef.current); setPhase('dead'); return }

      // ---- DRAW ----
      ctx.clearRect(0, 0, W, H)
      const bg = ctx.createLinearGradient(0,0,0,H)
      bg.addColorStop(0,'#030308'); bg.addColorStop(1,'#08031a')
      ctx.fillStyle = bg; ctx.fillRect(0,0,W,H)

      // Stars
      for (let i=0;i<60;i++) {
        const sx=((i*137+s.wallOffset*0.04)%(W+10))
        const sy=((i*79+3)%H)
        ctx.fillStyle=`rgba(255,255,255,${0.1+(i%5)*0.12})`
        ctx.beginPath(); ctx.arc(sx,sy,i%4===0?1.3:0.6,0,Math.PI*2); ctx.fill()
      }

      // Top/bottom cave walls
      ctx.fillStyle = '#140a2e'
      ctx.fillRect(0, 0, W, 10)
      ctx.fillRect(0, H-10, W, 10)
      ctx.strokeStyle = '#7B68EE44'; ctx.lineWidth = 2
      ctx.strokeRect(0,0,W,H)

      // Wall obstacles
      s.walls.forEach(w => {
        const wx = w.x - s.wallOffset
        if (wx < -60 || wx > W + 60) return

        // Top wall
        const grad1 = ctx.createLinearGradient(wx-22,0,wx+22,0)
        grad1.addColorStop(0,'#1e1060'); grad1.addColorStop(0.5,'#2d1b8e'); grad1.addColorStop(1,'#1e1060')
        ctx.fillStyle = grad1
        ctx.beginPath(); ctx.roundRect(wx-22,0,44,w.topH,[0,0,8,8]); ctx.fill()
        ctx.strokeStyle='#9B88FF'; ctx.lineWidth=2.5
        ctx.beginPath(); ctx.roundRect(wx-22,0,44,w.topH,[0,0,8,8]); ctx.stroke()

        // Bottom wall
        ctx.fillStyle = grad1
        ctx.beginPath(); ctx.roundRect(wx-22,w.botY,44,H-w.botY,[8,8,0,0]); ctx.fill()
        ctx.strokeStyle='#9B88FF'; ctx.lineWidth=2.5
        ctx.beginPath(); ctx.roundRect(wx-22,w.botY,44,H-w.botY,[8,8,0,0]); ctx.stroke()

        // Gap marker (subtle glow line)
        const gcY = (w.topH + w.botY) / 2
        ctx.strokeStyle='rgba(123,104,238,0.2)'; ctx.lineWidth=1; ctx.setLineDash([8,12])
        ctx.beginPath(); ctx.moveTo(wx,w.topH); ctx.lineTo(wx,w.botY); ctx.stroke()
        ctx.setLineDash([])

        // Danger glow when close
        const dist = Math.abs(wx - s.shipX)
        if (dist < 100) {
          ctx.shadowColor='#FF6B6B'; ctx.shadowBlur=8
          ctx.strokeStyle=`rgba(255,100,100,${(100-dist)/100*0.5})`; ctx.lineWidth=3
          ctx.beginPath(); ctx.roundRect(wx-22,0,44,w.topH,[0,0,8,8]); ctx.stroke()
          ctx.beginPath(); ctx.roundRect(wx-22,w.botY,44,H-w.botY,[8,8,0,0]); ctx.stroke()
          ctx.shadowBlur=0
        }
      })

      // Ship
      const { shipX: sx, shipY: sy } = s
      ctx.save(); ctx.translate(sx, sy)
      ctx.fillStyle='#A29BFE'; ctx.strokeStyle='#000'; ctx.lineWidth=2.5
      ctx.beginPath(); ctx.ellipse(0,0,22,11,0,0,Math.PI*2); ctx.fill(); ctx.stroke()
      ctx.fillStyle='#55EFC4'
      ctx.beginPath(); ctx.ellipse(0,-7,11,8,0,0,Math.PI*2); ctx.fill(); ctx.stroke()
      // Engine
      ctx.fillStyle='#FF6B6B'
      ctx.beginPath(); ctx.ellipse(-22,0,7,4,0,0,Math.PI*2); ctx.fill()
      ctx.fillStyle='#FFE66D'
      ctx.beginPath(); ctx.ellipse(-23,0,4,2.5,0,0,Math.PI*2); ctx.fill()
      // Trail
      ctx.strokeStyle='rgba(255,200,100,0.3)'; ctx.lineWidth=3
      ctx.beginPath(); ctx.moveTo(-25,0); ctx.lineTo(-40,0); ctx.stroke()
      ctx.restore()

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
    <div className="relative w-full h-full bg-black" style={{ touchAction: 'none' }}>
      <canvas ref={canvasRef} className="w-full h-full" />
      <MuteButton />
      {phase === 'playing' && (
        <>
          <GameHUD score={score} mode={mode} gameId="gyro-pilot" scoreUnit={game.scoreUnit} />
          {mode === 'trauma' && <TraumaIndicator isInverted={isInverted} justFlipped={justFlipped} />}
          <ControlHint hint={game.desktopHint} />
        </>
      )}
      {phase === 'countdown' && <CountdownOverlay onDone={startGame} />}
      {phase === 'dead' && (
        <GameOverScreen score={score} bestScore={bestScore} isNewRecord={isNewRecord}
          scoreUnit={game.scoreUnit} mode={mode} gameId="gyro-pilot" onRetry={() => setPhase('countdown')} />
      )}
    </div>
  )
}
