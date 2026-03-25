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

const ROAD_WIDTH_INIT = 2.8
const SEG_LEN = 5
const NUM_TILES = 35
const BALL_R = 0.32

export default function EdgeRoller() {
  const { mode } = useParams()
  const game = GAME_MAP['edge-roller']
  const { bestScore, isNewRecord, submitScore } = useLocalScore('edge-roller', mode)
  const mountRef = useRef(null)
  const invertedRef = useRef(false)
  const inputRef = useRef(0)
  const scoreRef = useRef(0)
  const [phase, setPhase] = useState('waiting')
  const [score, setScore] = useState(0)
  const [isInverted, setIsInverted] = useState(false)
  const [justFlipped, setJustFlipped] = useState(false)

  useEffect(() => {
    const keys = {}
    const kd = (e) => { keys[e.key] = true }
    const ku = (e) => { keys[e.key] = false }
    const mm = (e) => { inputRef.current = Math.max(-1, Math.min(1, (e.clientX / window.innerWidth - 0.5) * 2.2)) }
    const tick = setInterval(() => {
      if (keys['ArrowLeft'] || keys['a']) inputRef.current = -1
      else if (keys['ArrowRight'] || keys['d']) inputRef.current = 1
      else inputRef.current = inputRef.current * 0.9
    }, 16)
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku)
    window.addEventListener('mousemove', mm)
    return () => {
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku)
      window.removeEventListener('mousemove', mm); clearInterval(tick)
    }
  }, [])

  const handleTap = useCallback(() => {
    if (phase === 'waiting') setPhase('playing')
  }, [phase])

  useEffect(() => {
    const onKey = (e) => { if (e.code === 'Space') handleTap() }
    const onClick = () => handleTap()
    window.addEventListener('keydown', onKey); window.addEventListener('click', onClick)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('click', onClick) }
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
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x020208)
    scene.fog = new THREE.FogExp2(0x020208, 0.055)

    const camera = new THREE.PerspectiveCamera(68, W / H, 0.1, 150)

    // Lighting
    scene.add(new THREE.AmbientLight(0x4040ff, 0.5))
    const dl = new THREE.DirectionalLight(0x8888ff, 1)
    dl.position.set(3, 8, 2); dl.castShadow = true; scene.add(dl)
    const ballGlow = new THREE.PointLight(0x4ECDC4, 2, 6); scene.add(ballGlow)

    // Void particles
    const pts = new THREE.BufferGeometry()
    const pv = []
    for (let i = 0; i < 600; i++) {
      pv.push((Math.random()-0.5)*100, (Math.random()-0.5)*30-5, (Math.random()-0.5)*300)
    }
    pts.setAttribute('position', new THREE.Float32BufferAttribute(pv, 3))
    scene.add(new THREE.Points(pts, new THREE.PointsMaterial({ color: 0x6644ff, size: 0.12 })))

    // Path generation — smooth with momentum
    const genPath = (count, startZ = 0) => {
      const arr = [{ x: 0, z: startZ }]
      let x = 0, vx = 0
      for (let i = 1; i < count; i++) {
        vx += (Math.random()-0.5)*0.9; vx = Math.max(-1.4,Math.min(1.4,vx)); vx*=0.9
        x += vx; x = Math.max(-7, Math.min(7, x))
        arr.push({ x, z: startZ + i * SEG_LEN })
      }
      return arr
    }

    const roadMat = new THREE.MeshPhongMaterial({ color: 0x201880, shininess: 60 })
    const edgeMat = new THREE.MeshPhongMaterial({ color: 0xFFE66D, emissive: 0xaa8800, shininess: 120, shininess: 80 })
    const underMat = new THREE.MeshPhongMaterial({ color: 0x150e40 })

    const tiles = []
    const makeTile = (pA, pB, rw, idx) => {
      const mid = { x:(pA.x+pB.x)/2, z:(pA.z+pB.z)/2 }
      const dx = pB.x-pA.x, dz = SEG_LEN
      const angle = Math.atan2(dx, dz)

      // Surface
      const surf = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.18, SEG_LEN), roadMat)
      surf.rotation.y = -angle
      surf.position.set(mid.x, 0, -mid.z)
      surf.receiveShadow = true; scene.add(surf)

      // Under face (slightly darker)
      const under = new THREE.Mesh(new THREE.BoxGeometry(rw-0.1, 0.5, SEG_LEN), underMat)
      under.rotation.y = -angle
      under.position.set(mid.x, -0.3, -mid.z)
      scene.add(under)

      // Edges
      const eGeo = new THREE.BoxGeometry(0.16, 0.28, SEG_LEN)
      const le = new THREE.Mesh(eGeo, edgeMat)
      le.rotation.y = -angle
      le.position.set(mid.x - Math.cos(angle)*rw/2, 0.14, -mid.z)
      scene.add(le)

      const re = new THREE.Mesh(eGeo, edgeMat)
      re.rotation.y = -angle
      re.position.set(mid.x + Math.cos(angle)*rw/2, 0.14, -mid.z)
      scene.add(re)

      return { surf, under, le, re, pA, pB, idx, angle }
    }

    const state = {
      path: genPath(NUM_TILES + 20),
      ballX: 0, ballVX: 0,
      speed: 2.2, frameCount: 0, progress: 0,
      roadWidth: ROAD_WIDTH_INIT,
      lastTraumaFlip: Date.now(), nextTraumaDelay: randomBetween(2500, 7000),
      dead: false,
    }

    for (let i = 0; i < NUM_TILES; i++) {
      tiles.push(makeTile(state.path[i], state.path[i+1], ROAD_WIDTH_INIT, i))
    }

    // Ball
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R, 24, 24),
      new THREE.MeshPhongMaterial({ color: 0x4ECDC4, shininess: 160, emissive: 0x1a8a80, emissiveIntensity: 0.4 })
    )
    ball.castShadow = true; scene.add(ball)

    // Waiting screen overlay mesh (plane with texture)
    let waitText = null
    if (phase === 'waiting') {
      // Just use fog / scene — waiting handled by React overlay
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
      s.speed = Math.min(2.2 + s.frameCount/320, 9)
      s.roadWidth = Math.max(1.2, ROAD_WIDTH_INIT - s.frameCount/550)
      s.progress += s.speed * delta

      // Extend path
      const segIdx = Math.floor(s.progress)
      if (segIdx + NUM_TILES + 5 > state.path.length) {
        const last = state.path[state.path.length-1]
        state.path.push(...genPath(20, last.z).slice(1))
      }

      // Ball lateral movement
      const input = invertAxis(inputRef.current, invertedRef.current)
      s.ballVX += input * 0.038; s.ballVX *= 0.83
      s.ballX += s.ballVX
      s.ballX = Math.max(-10, Math.min(10, s.ballX))

      const seg = state.path[Math.min(segIdx, state.path.length-2)]
      const segN = state.path[Math.min(segIdx+1, state.path.length-1)]
      const t = s.progress - segIdx
      const centerX = seg.x + (segN.x - seg.x)*t
      const centerZ = seg.z + SEG_LEN*t

      ball.position.set(centerX + s.ballX, BALL_R+0.09, -centerZ)
      ball.rotation.x += s.speed*0.06; ball.rotation.z -= s.ballVX*0.4
      ballGlow.position.copy(ball.position)

      // Fall check
      if (Math.abs(s.ballX) > s.roadWidth/2 + 0.25) {
        s.dead = true; sfx.gameOver()
        const sc = Math.floor(s.progress*3); submitScore(sc)
        setPhase('dead'); return
      }

      scoreRef.current = Math.floor(s.progress*3); setScore(scoreRef.current)

      // Recycle tiles
      tiles.forEach(tile => {
        if (tile.pA.z < centerZ - SEG_LEN*3) {
          const ni = tile.idx + NUM_TILES
          if (ni < state.path.length-1) {
            const pA=state.path[ni], pB=state.path[ni+1]
            const mid={x:(pA.x+pB.x)/2, z:(pA.z+pB.z)/2}
            const dx=pB.x-pA.x
            const ang=Math.atan2(dx, SEG_LEN)
            const rw = s.roadWidth
            tile.surf.rotation.y=-ang; tile.surf.position.set(mid.x,0,-mid.z); tile.surf.scale.x=rw/ROAD_WIDTH_INIT
            tile.under.rotation.y=-ang; tile.under.position.set(mid.x,-0.3,-mid.z); tile.under.scale.x=Math.max(0.1,(rw-0.1)/ROAD_WIDTH_INIT)
            tile.le.rotation.y=-ang; tile.le.position.set(mid.x-Math.cos(ang)*rw/2,0.14,-mid.z)
            tile.re.rotation.y=-ang; tile.re.position.set(mid.x+Math.cos(ang)*rw/2,0.14,-mid.z)
            tile.pA=pA; tile.pB=pB; tile.idx=ni
          }
        }
      })

      // Camera
      camera.position.lerp(new THREE.Vector3(ball.position.x*0.25, ball.position.y+3.2, ball.position.z+5), 0.1)
      camera.lookAt(ball.position.x*0.1, ball.position.y, ball.position.z-5)

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

      {/* Waiting overlay */}
      {phase === 'waiting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
          <div className="text-6xl mb-4 animate-bounce">🎱</div>
          <div className="font-display text-white text-4xl mb-2" style={{ textShadow:'3px 3px 0 #FFE66D' }}>Edge Roller</div>
          <div className="cartoon-card px-6 py-3 bg-black/60 border-yellow-400 font-display text-yellow-300 text-xl mt-4"
            style={{ boxShadow:'4px 4px 0 #886600' }}>
            Tap / Click to Start
          </div>
          <div className="mt-3 text-white/50 font-body text-sm">A / D or ← → to steer</div>
        </div>
      )}

      {phase === 'playing' && (
        <>
          <GameHUD score={score} mode={mode} gameId="edge-roller" scoreUnit={game.scoreUnit} />
          {mode === 'trauma' && <TraumaIndicator isInverted={isInverted} justFlipped={justFlipped} />}
          <ControlHint hint={game.desktopHint} />
        </>
      )}
      {phase === 'dead' && (
        <GameOverScreen score={score} bestScore={bestScore} isNewRecord={isNewRecord}
          scoreUnit={game.scoreUnit} mode={mode} gameId="edge-roller"
          onRetry={() => { scoreRef.current=0; setScore(0); setPhase('waiting') }} />
      )}
    </div>
  )
}
