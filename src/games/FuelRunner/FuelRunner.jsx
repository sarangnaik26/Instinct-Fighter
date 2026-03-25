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

const MAX_FUEL = 100
const FUEL_DRAIN = 0.08

export default function FuelRunner() {
  const { mode } = useParams()
  const game = GAME_MAP['fuel-runner']
  const { bestScore, isNewRecord, submitScore } = useLocalScore('fuel-runner', mode)
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const animRef = useRef(null)
  const invertedRef = useRef(false)
  const scoreRef = useRef(0)
  const pressedRef = useRef(false)
  const [phase, setPhase] = useState('countdown')
  const [score, setScore] = useState(0)
  const [isInverted, setIsInverted] = useState(false)
  const [justFlipped, setJustFlipped] = useState(false)

  const genTerrain = (startX, count) => {
    const pts = []
    let y = 0
    for (let i = 0; i < count; i++) {
      y += (Math.random() - 0.5) * 60
      y = Math.max(-120, Math.min(120, y))
      pts.push({ x: startX + i * 80, y })
    }
    return pts
  }

  const initState = (W, H) => {
    const terrain = genTerrain(0, 30)
    return {
      carX: 100, carY: 0, carVY: 0, carAngle: 0,
      terrain, fuel: MAX_FUEL,
      fuelCans: [{ x: 200, collected: false }, { x: 450, collected: false }],
      offset: 0, frameCount: 0, speed: 0, maxSpeed: 5,
      lastTraumaFlip: Date.now(), nextTraumaDelay: randomBetween(2000, 6000),
      W, H,
    }
  }

  const getTerrainY = (x, terrain, H) => {
    const baseY = H * 0.6
    for (let i = 0; i < terrain.length - 1; i++) {
      if (x >= terrain[i].x && x <= terrain[i + 1].x) {
        const t = (x - terrain[i].x) / (terrain[i + 1].x - terrain[i].x)
        return baseY + terrain[i].y * (1 - t) + terrain[i + 1].y * t
      }
    }
    return baseY
  }

  useEffect(() => {
    const onDown = (e) => {
      if (e.code === 'Space' || e.type === 'touchstart') { e.preventDefault(); pressedRef.current = true; resumeCtx() }
    }
    const onUp = () => { pressedRef.current = false }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('touchstart', onDown, { passive: false })
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp)
      window.removeEventListener('touchstart', onDown); window.removeEventListener('touchend', onUp)
    }
  }, [])

  const startGame = () => {
    const c = canvasRef.current
    scoreRef.current = 0; setScore(0); setIsInverted(false); invertedRef.current = false
    pressedRef.current = false
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
          s.lastTraumaFlip = now; s.nextTraumaDelay = randomBetween(2000, 6000)
        }
      } else invertedRef.current = mode === 'instinct'

      const inv = invertedRef.current
      const pressed = pressedRef.current

      // Acceleration logic
      if (inv ? pressed : !pressed) {
        s.speed = Math.min(s.speed + 0.08, s.maxSpeed)
      } else {
        s.speed = Math.max(s.speed - 0.15, 0)
      }
      if (!inv && pressed) sfx.jump() // Brake sfx

      s.offset += s.speed
      s.frameCount++
      s.maxSpeed = Math.min(5 + s.frameCount / 600, 9)

      // Extend terrain
      if (s.terrain.length < 30 || s.terrain[s.terrain.length - 1].x - s.offset < W + 200) {
        const last = s.terrain[s.terrain.length - 1]
        const extra = genTerrain(last.x + 80, 10)
        s.terrain.push(...extra)
      }
      s.terrain = s.terrain.filter(p => p.x - s.offset > -200)

      // Car gravity / terrain follow
      const groundY = getTerrainY(s.carX + s.offset, s.terrain, H)
      const targetY = groundY - 20
      s.carY += (targetY - s.carY) * 0.2

      // Fuel drain
      s.fuel = Math.max(0, s.fuel - FUEL_DRAIN)

      // Fuel cans
      s.fuelCans.forEach(can => {
        if (!can.collected && Math.abs((can.x - s.offset) - s.carX) < 30 && Math.abs(can.y - s.carY) < 30) {
          can.collected = true; s.fuel = Math.min(MAX_FUEL, s.fuel + 35); sfx.collect()
        }
        if (can.x - s.offset < -100) {
          can.x = s.offset + W + randomBetween(100, 300); can.collected = false
          can.y = getTerrainY(can.x, s.terrain, H) - 20
        }
      })

      scoreRef.current = Math.floor(s.offset / 10)
      setScore(scoreRef.current)

      if (s.fuel <= 0) { sfx.gameOver(); submitScore(scoreRef.current); setPhase('dead'); return }

      // Draw
      ctx.clearRect(0, 0, W, H)
      const sky = ctx.createLinearGradient(0, 0, 0, H)
      sky.addColorStop(0, '#87CEEB'); sky.addColorStop(1, '#E0F0FF')
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H)

      // Terrain
      ctx.beginPath(); ctx.moveTo(0, H)
      s.terrain.forEach(p => ctx.lineTo(p.x - s.offset, H * 0.6 + p.y))
      ctx.lineTo(W, H); ctx.closePath()
      ctx.fillStyle = '#6B8E23'; ctx.fill()
      ctx.strokeStyle = '#4a6b14'; ctx.lineWidth = 3; ctx.stroke()

      // Dirt layer
      ctx.beginPath(); ctx.moveTo(0, H)
      s.terrain.forEach(p => ctx.lineTo(p.x - s.offset, H * 0.6 + p.y + 20))
      ctx.lineTo(W, H); ctx.closePath()
      ctx.fillStyle = '#8B6914'; ctx.fill()

      // Fuel cans
      s.fuelCans.forEach(can => {
        if (can.collected) return
        const cx = can.x - s.offset
        const cy = getTerrainY(can.x, s.terrain, H) - 22
        ctx.fillStyle = '#FF6B6B'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2
        ctx.fillRect(cx - 10, cy - 16, 20, 28); ctx.strokeRect(cx - 10, cy - 16, 20, 28)
        ctx.fillStyle = '#FFE66D'; ctx.font = 'bold 10px Nunito'; ctx.textAlign = 'center'
        ctx.fillText('⛽', cx, cy + 6)
      })

      // Car
      const carScreenX = s.carX
      const carScreenY = s.carY
      ctx.save(); ctx.translate(carScreenX, carScreenY)
      // Body
      ctx.fillStyle = '#FF6B6B'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3
      ctx.beginPath(); ctx.roundRect(-30, -22, 60, 22, 6); ctx.fill(); ctx.stroke()
      ctx.fillStyle = '#FF4444'
      ctx.beginPath(); ctx.roundRect(-20, -38, 40, 18, 6); ctx.fill(); ctx.stroke()
      // Windows
      ctx.fillStyle = '#87CEEB'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2
      ctx.fillRect(-16, -36, 14, 12); ctx.strokeRect(-16, -36, 14, 12)
      ctx.fillRect(2, -36, 14, 12); ctx.strokeRect(2, -36, 14, 12)
      // Wheels
      ;[[-18, 2], [18, 2]].forEach(([wx, wy]) => {
        ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(wx, wy, 11, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke()
        ctx.fillStyle = '#888'; ctx.beginPath(); ctx.arc(wx, wy, 5, 0, Math.PI * 2); ctx.fill()
      })
      ctx.restore()

      // Fuel bar
      const fuelW = 120
      ctx.fillStyle = '#333'; ctx.fillRect(10, H - 34, fuelW + 4, 20)
      const fuelColor = s.fuel > 30 ? '#55EFC4' : '#FF6B6B'
      ctx.fillStyle = fuelColor; ctx.fillRect(12, H - 32, (s.fuel / MAX_FUEL) * fuelW, 16)
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(10, H - 34, fuelW + 4, 20)
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Nunito'; ctx.textAlign = 'left'
      ctx.fillText('⛽ FUEL', 14, H - 20)

      // Brake indicator when inverted
      if (inv && pressedRef.current) {
        ctx.fillStyle = 'rgba(255,100,100,0.8)'
        ctx.font = 'bold 18px Fredoka One'; ctx.textAlign = 'center'
        ctx.fillText('🛑 BRAKING!', W / 2, H - 50)
      }

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
          <GameHUD score={score} mode={mode} gameId="fuel-runner" scoreUnit={game.scoreUnit} />
          {mode === 'trauma' && <TraumaIndicator isInverted={isInverted} justFlipped={justFlipped} />}
          <ControlHint hint={game.desktopHint} />
        </>
      )}
      {phase === 'countdown' && <CountdownOverlay onDone={startGame} />}
      {phase === 'dead' && (
        <GameOverScreen score={score} bestScore={bestScore} isNewRecord={isNewRecord}
          scoreUnit={game.scoreUnit} mode={mode} gameId="fuel-runner"
          onRetry={() => setPhase('countdown')} />
      )}
    </div>
  )
}
