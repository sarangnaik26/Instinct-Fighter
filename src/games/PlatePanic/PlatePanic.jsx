import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import * as THREE from 'three'
import { GAME_MAP } from '../../data/games'
import { useLocalScore } from '../../hooks/useLocalScore'
import { invertAxis, randomBetween } from '../../utils/invertControl'
import { sfx } from '../../audio/audioManager'
import GameHUD from '../../components/GameHUD'
import GameOverScreen from '../../components/GameOverScreen'
import TraumaIndicator from '../../components/TraumaIndicator'
import ControlHint from '../../components/ControlHint'
import MuteButton from '../../components/MuteButton'
import { isMobileDevice } from '../../utils/deviceDetect'

const PLATE_W = 5.5
const PLATE_D = 4.0
const PLATE_H = 0.22
const BALL_R  = 0.42

export default function PlatePanic() {
  const { mode } = useParams()
  const game = GAME_MAP['plate-panic']
  const { bestScore, isNewRecord, submitScore } = useLocalScore('plate-panic', mode)
  const mountRef = useRef(null)
  const invertedRef = useRef(false)
  const inputRef = useRef({ x: 0, y: 0 })
  const scoreRef = useRef(0)
  const [phase, setPhase] = useState('waiting')
  const [score, setScore] = useState(0)
  const [isInverted, setIsInverted] = useState(false)
  const [justFlipped, setJustFlipped] = useState(false)

  // Input
  useEffect(() => {
    if (isMobileDevice()) {
      const h = (e) => {
        inputRef.current = {
          x: Math.max(-1, Math.min(1, (e.gamma||0)/28)),
          y: Math.max(-1, Math.min(1, (e.beta||0)/28)),
        }
      }
      window.addEventListener('deviceorientation', h)
      return () => window.removeEventListener('deviceorientation', h)
    }
    const keys = {}
    const kd = (e) => { keys[e.key]=true }
    const ku = (e) => { keys[e.key]=false }
    const tick = setInterval(() => {
      inputRef.current = {
        x: (keys['d']||keys['ArrowRight']?1:0)-(keys['a']||keys['ArrowLeft']?1:0),
        y: (keys['s']||keys['ArrowDown']?1:0)-(keys['w']||keys['ArrowUp']?1:0),
      }
    }, 16)
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku)
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); clearInterval(tick) }
  }, [])

  const handleTap = useCallback(() => {
    if (phase === 'waiting') setPhase('playing')
  }, [phase])

  useEffect(() => {
    const kd = (e) => { if (e.code==='Space') handleTap() }
    const cl = () => handleTap()
    window.addEventListener('keydown', kd); window.addEventListener('click', cl)
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('click', cl) }
  }, [handleTap])

  useEffect(() => {
    if (phase !== 'playing') return
    const mount = mountRef.current
    if (!mount) return

    const W = mount.clientWidth, H = mount.clientHeight
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x080818)

    // Camera — angled from above like a board game
    const camera = new THREE.PerspectiveCamera(55, W/H, 0.1, 100)
    camera.position.set(0, 9, 7)
    camera.lookAt(0, 0, 0)

    // Lights
    scene.add(new THREE.AmbientLight(0x5050aa, 0.7))
    const dl = new THREE.DirectionalLight(0xffffff, 1.4)
    dl.position.set(5, 12, 6)
    dl.castShadow = true
    dl.shadow.mapSize.set(1024, 1024)
    scene.add(dl)
    const ballGlow = new THREE.PointLight(0xff6b6b, 2, 5)
    scene.add(ballGlow)
    const rimLight = new THREE.PointLight(0xa29bfe, 1.2, 12)
    rimLight.position.set(-4, 4, -4); scene.add(rimLight)

    // Floating particles in background
    const pgeo = new THREE.BufferGeometry()
    const pv = []
    for (let i=0;i<400;i++) pv.push((Math.random()-0.5)*30,(Math.random()-0.5)*20,(Math.random()-0.5)*30)
    pgeo.setAttribute('position',new THREE.Float32BufferAttribute(pv,3))
    scene.add(new THREE.Points(pgeo, new THREE.PointsMaterial({color:0x6644ff,size:0.08})))

    // ── Plate pivot (parent that we tilt) ──────────────
    const platePivot = new THREE.Object3D()
    scene.add(platePivot)

    // Plate surface
    const plateMat = new THREE.MeshPhongMaterial({
      color: 0x3a2f7a, shininess: 80,
      emissive: 0x1a1040, emissiveIntensity: 0.4,
    })
    const plate = new THREE.Mesh(new THREE.BoxGeometry(PLATE_W, PLATE_H, PLATE_D), plateMat)
    plate.receiveShadow = true; plate.castShadow = true
    platePivot.add(plate)

    // Grid lines on plate top
    const gridMat = new THREE.LineBasicMaterial({ color: 0x7b68ee, transparent: true, opacity: 0.35 })
    for (let gx = -PLATE_W/2+0.6; gx < PLATE_W/2; gx+=0.8) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(gx, PLATE_H/2+0.01, -PLATE_D/2),
        new THREE.Vector3(gx, PLATE_H/2+0.01,  PLATE_D/2),
      ])
      platePivot.add(new THREE.Line(geo, gridMat))
    }
    for (let gz = -PLATE_D/2+0.6; gz < PLATE_D/2; gz+=0.8) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-PLATE_W/2, PLATE_H/2+0.01, gz),
        new THREE.Vector3( PLATE_W/2, PLATE_H/2+0.01, gz),
      ])
      platePivot.add(new THREE.Line(geo, gridMat))
    }

    // Glowing edges
    const edgeMat = new THREE.MeshPhongMaterial({ color: 0xa29bfe, emissive: 0x6644ff, shininess: 120 })
    const corners = [
      [-PLATE_W/2, PLATE_D/2], [PLATE_W/2, PLATE_D/2],
      [-PLATE_W/2,-PLATE_D/2], [PLATE_W/2,-PLATE_D/2],
    ]
    const edgeConfigs = [
      { pos:[0,PLATE_D/2], rot:0, len:PLATE_W },
      { pos:[0,-PLATE_D/2], rot:0, len:PLATE_W },
      { pos:[-PLATE_W/2,0], rot:Math.PI/2, len:PLATE_D },
      { pos:[PLATE_W/2,0], rot:Math.PI/2, len:PLATE_D },
    ]
    edgeConfigs.forEach(e => {
      const em = new THREE.Mesh(new THREE.BoxGeometry(e.len, 0.12, 0.12), edgeMat)
      em.position.set(e.pos[0], PLATE_H/2+0.06, e.pos[1])
      em.rotation.y = e.rot
      platePivot.add(em)
    })

    // Under-plate glow disc
    const discMat = new THREE.MeshBasicMaterial({ color: 0x7b68ee, transparent: true, opacity: 0.15, side: THREE.BackSide })
    platePivot.add(new THREE.Mesh(new THREE.CircleGeometry(PLATE_W*0.6, 32), discMat))

    // Ball
    const ballMat = new THREE.MeshPhongMaterial({
      color: 0xFF6B6B, shininess: 180,
      emissive: 0x8b0000, emissiveIntensity: 0.3,
      specular: 0xffffff,
    })
    const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 28, 28), ballMat)
    ball.castShadow = true
    scene.add(ball)

    // Ball shine spot
    const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
    const shine = new THREE.Mesh(new THREE.SphereGeometry(BALL_R*0.22, 8, 8), shineMat)
    ball.add(shine); shine.position.set(BALL_R*0.45, BALL_R*0.45, BALL_R*0.45)

    // Shadow disc under ball
    const shadowDisc = new THREE.Mesh(
      new THREE.CircleGeometry(BALL_R*0.8, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })
    )
    shadowDisc.rotation.x = -Math.PI/2
    scene.add(shadowDisc)

    // State
    const state = {
      ballX: 0, ballZ: 0, ballVX: 0, ballVZ: 0,
      tiltX: 0, tiltZ: 0,
      swayAngle: 0, frameCount: 0, survived: 0,
      lastTraumaFlip: Date.now(), nextTraumaDelay: randomBetween(2500, 7000),
      dead: false,
    }

    let animId
    const animate = () => {
      animId = requestAnimationFrame(animate)
      const s = state
      const now = Date.now()
      if (s.dead) return

      // Trauma
      if (mode === 'trauma') {
        if (now - s.lastTraumaFlip > s.nextTraumaDelay) {
          invertedRef.current = !invertedRef.current
          setIsInverted(invertedRef.current); setJustFlipped(true)
          setTimeout(() => setJustFlipped(false), 500); sfx.flip()
          s.lastTraumaFlip = now; s.nextTraumaDelay = randomBetween(2500, 7000)
        }
      } else invertedRef.current = mode === 'instinct'

      s.frameCount++
      const difficulty = Math.min(1, s.frameCount/1200)

      const ix = invertAxis(inputRef.current.x, invertedRef.current)
      const iy = invertAxis(inputRef.current.y, invertedRef.current)

      // Target tilt
      const targetTiltZ = -ix * 0.36
      const targetTiltX = iy * 0.36
      s.tiltZ += (targetTiltZ - s.tiltZ) * 0.12
      s.tiltX += (targetTiltX - s.tiltX) * 0.12

      // Auto sway
      s.swayAngle += 0.016 * (1 + difficulty)
      const swayZ = Math.sin(s.swayAngle) * 0.13 * (1 + difficulty)
      const swayX = Math.cos(s.swayAngle*0.7) * 0.08 * difficulty

      const totalTiltZ = s.tiltZ + swayZ
      const totalTiltX = s.tiltX + swayX

      // Apply to plate pivot
      platePivot.rotation.z = totalTiltZ
      platePivot.rotation.x = totalTiltX

      // Ball physics — gravity rolls ball according to tilt
      const gravity = 0.28
      s.ballVX += -totalTiltZ * gravity
      s.ballVZ += totalTiltX * gravity
      s.ballVX *= 0.965; s.ballVZ *= 0.965
      s.ballX += s.ballVX; s.ballZ += s.ballVZ

      // Position ball on plate surface
      const plateTopY = PLATE_H/2 + BALL_R
      // Compute actual world Y from tilt
      const worldY = plateTopY +
        -s.ballX * Math.sin(totalTiltZ) +
        s.ballZ * Math.sin(totalTiltX)

      ball.position.set(s.ballX, worldY, s.ballZ)
      ball.rotation.z -= s.ballVX * 0.6
      ball.rotation.x += s.ballVZ * 0.6
      ballGlow.position.copy(ball.position)
      shadowDisc.position.set(s.ballX, PLATE_H/2 + 0.02, s.ballZ)

      // Edge danger glow
      const edgeFracX = Math.abs(s.ballX)/(PLATE_W/2)
      const edgeFracZ = Math.abs(s.ballZ)/(PLATE_D/2)
      const edgeFrac = Math.max(edgeFracX, edgeFracZ)
      edgeMat.emissiveIntensity = 0.3 + edgeFrac * 1.5
      edgeMat.color.setHex(edgeFrac > 0.75 ? 0xff4444 : 0xa29bfe)
      ballGlow.intensity = 1.5 + edgeFrac * 2

      // Check fall off
      if (Math.abs(s.ballX) > PLATE_W/2 + 0.5 || Math.abs(s.ballZ) > PLATE_D/2 + 0.5) {
        s.dead = true; sfx.gameOver()
        submitScore(scoreRef.current); setPhase('dead'); return
      }

      s.survived = Math.floor(s.frameCount/60)
      scoreRef.current = s.survived; setScore(s.survived)

      // Gentle camera sway for immersion
      const camSway = Math.sin(s.swayAngle*0.4)*0.3
      camera.position.set(camSway, 9, 7)
      camera.lookAt(0, 0, 0)

      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      const W2=mount.clientWidth, H2=mount.clientHeight
      renderer.setSize(W2,H2); camera.aspect=W2/H2; camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [phase, mode])

  return (
    <div className="relative w-full h-full bg-black" style={{ touchAction: 'none' }}
      onTouchStart={(e) => { e.preventDefault(); handleTap() }}>
      <div ref={mountRef} className="w-full h-full" />
      <MuteButton />

      {phase === 'waiting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55">
          <div className="text-6xl mb-4 animate-float">⚖️</div>
          <div className="font-display text-white text-4xl mb-2" style={{ textShadow:'3px 3px 0 #a29bfe' }}>Plate Panic</div>
          <div className="font-body text-gray-400 text-sm mb-6 text-center px-8">
            Tilt the plate. Keep the ball from falling off.
          </div>
          <div className="cartoon-card px-6 py-3 bg-black/60 border-purple-400 font-display text-purple-300 text-xl"
            style={{ boxShadow:'4px 4px 0 #6644ff' }}>
            Tap / Click to Start
          </div>
          <div className="mt-3 text-white/45 font-body text-sm">WASD / Arrow Keys to tilt</div>
        </div>
      )}

      {phase === 'playing' && (
        <>
          <GameHUD score={score} mode={mode} gameId="plate-panic" scoreUnit={game.scoreUnit} />
          {mode === 'trauma' && <TraumaIndicator isInverted={isInverted} justFlipped={justFlipped} />}
          <ControlHint hint={game.desktopHint} />
        </>
      )}
      {phase === 'dead' && (
        <GameOverScreen score={score} bestScore={bestScore} isNewRecord={isNewRecord}
          scoreUnit={game.scoreUnit} mode={mode} gameId="plate-panic"
          onRetry={() => { scoreRef.current=0; setScore(0); setPhase('waiting') }} />
      )}
    </div>
  )
}
