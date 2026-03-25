import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import * as THREE from 'three'
import { GAME_MAP } from '../../data/games'
import { useLocalScore } from '../../hooks/useLocalScore'
import { invertAxis, randomBetween } from '../../utils/invertControl'
import { sfx } from '../../audio/audioManager'
import GameHUD from '../../components/GameHUD'
import GameOverScreen from '../../components/GameOverScreen'
import CountdownOverlay from '../../components/CountdownOverlay'
import TraumaIndicator from '../../components/TraumaIndicator'
import ControlHint from '../../components/ControlHint'
import MuteButton from '../../components/MuteButton'
import { isMobileDevice } from '../../utils/deviceDetect'

const ROAD_INIT_WIDTH = 4.5
const SEGMENT_LENGTH = 6
const NUM_SEGMENTS = 40
const BALL_RADIUS = 0.35

export default function TiltRunner() {
  const { mode } = useParams()
  const game = GAME_MAP['tilt-runner']
  const { bestScore, isNewRecord, submitScore } = useLocalScore('tilt-runner', mode)
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const invertedRef = useRef(false)
  const inputRef = useRef(0)
  const scoreRef = useRef(0)
  const [phase, setPhase] = useState('countdown')
  const [score, setScore] = useState(0)
  const [isInverted, setIsInverted] = useState(false)
  const [justFlipped, setJustFlipped] = useState(false)

  // ── Input ──────────────────────────────────────────
  useEffect(() => {
    if (isMobileDevice()) {
      const h = (e) => { inputRef.current = Math.max(-1, Math.min(1, (e.gamma || 0) / 40)) }
      window.addEventListener('deviceorientation', h)
      return () => window.removeEventListener('deviceorientation', h)
    }
    const keys = {}
    const kd = (e) => { keys[e.key] = true }
    const ku = (e) => { keys[e.key] = false }
    const mm = (e) => { inputRef.current = Math.max(-1, Math.min(1, (e.clientX / window.innerWidth - 0.5) * 2.2)) }
    const tick = setInterval(() => {
      if (keys['ArrowLeft'] || keys['a']) inputRef.current = -1
      else if (keys['ArrowRight'] || keys['d']) inputRef.current = 1
      else if (!Object.values(keys).some(Boolean)) inputRef.current = 0
    }, 16)
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku)
    window.addEventListener('mousemove', mm)
    return () => {
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku)
      window.removeEventListener('mousemove', mm); clearInterval(tick)
    }
  }, [])

  // ── Main 3D scene ───────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return
    const mount = mountRef.current
    if (!mount) return

    // Renderer
    const W = mount.clientWidth, H = mount.clientHeight
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x05050f)
    scene.fog = new THREE.FogExp2(0x05050f, 0.045)

    // Camera — behind the ball, looking forward
    const camera = new THREE.PerspectiveCamera(65, W / H, 0.1, 200)

    // Lights
    scene.add(new THREE.AmbientLight(0x7070ff, 0.6))
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
    dirLight.position.set(5, 10, 2)
    dirLight.castShadow = true
    scene.add(dirLight)
    const ballLight = new THREE.PointLight(0x4ECDC4, 1.5, 8)
    scene.add(ballLight)

    // Stars
    const starGeo = new THREE.BufferGeometry()
    const starVerts = []
    for (let i = 0; i < 800; i++) {
      starVerts.push((Math.random() - 0.5) * 200, Math.random() * 40 + 2, (Math.random() - 0.5) * 400)
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3))
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.15 })))

    // Road path — array of {x, z} waypoints
    const genPath = (count, startZ = 0) => {
      const pts = [{ x: 0, z: startZ }]
      let x = 0, vx = 0
      for (let i = 1; i < count; i++) {
        vx += (Math.random() - 0.5) * 1.2; vx = Math.max(-1.8, Math.min(1.8, vx)); vx *= 0.88
        x += vx; x = Math.max(-8, Math.min(8, x))
        pts.push({ x, z: startZ + i * SEGMENT_LENGTH })
      }
      return pts
    }

    // Create a road mesh from path points
    const makeTileGeo = (pA, pB, width) => {
      const dx = pB.x - pA.x, dz = SEGMENT_LENGTH
      const len = Math.sqrt(dx * dx + dz * dz)
      const geo = new THREE.PlaneGeometry(width, len)
      return geo
    }

    // Road tiles array
    const roadTiles = []
    const roadMat = new THREE.MeshPhongMaterial({ color: 0x2a2080, emissive: 0x110860, shininess: 40, side: THREE.DoubleSide })
    const edgeMat = new THREE.MeshPhongMaterial({ color: 0xFFE66D, emissive: 0x886600, shininess: 100 })

    const createTile = (pA, pB, width) => {
      const mid = { x: (pA.x + pB.x) / 2, z: (pA.z + pB.z) / 2 }
      const dx = pB.x - pA.x, dz = pB.z - pA.z
      const len = Math.sqrt(dx * dx + dz * dz)
      const angle = Math.atan2(dx, dz)

      // Road surface
      const geo = new THREE.PlaneGeometry(width, len)
      const mesh = new THREE.Mesh(geo, roadMat)
      mesh.rotation.x = -Math.PI / 2
      mesh.rotation.z = -angle
      mesh.position.set(mid.x, 0, -mid.z)
      mesh.receiveShadow = true
      scene.add(mesh)

      // Left edge
      const edgeGeo = new THREE.BoxGeometry(0.18, 0.22, len)
      const leftEdge = new THREE.Mesh(edgeGeo, edgeMat)
      leftEdge.rotation.y = -angle
      leftEdge.position.set(mid.x - Math.cos(angle) * width / 2, 0.11, -mid.z)
      scene.add(leftEdge)

      const rightEdge = new THREE.Mesh(edgeGeo, edgeMat)
      rightEdge.rotation.y = -angle
      rightEdge.position.set(mid.x + Math.cos(angle) * width / 2, 0.11, -mid.z)
      scene.add(rightEdge)

      return { mesh, leftEdge, rightEdge, pA, pB, mid, angle }
    }

    // Game state
    const state = {
      path: genPath(NUM_SEGMENTS + 20),
      ballX: 0, ballVX: 0,
      speed: 2.5, frameCount: 0,
      pathProgress: 0, // which segment ball is on
      roadWidth: ROAD_INIT_WIDTH,
      lastTraumaFlip: Date.now(), nextTraumaDelay: randomBetween(2500, 7000),
      dead: false,
    }

    // Build initial tiles
    for (let i = 0; i < NUM_SEGMENTS; i++) {
      const tile = createTile(state.path[i], state.path[i + 1], state.roadWidth)
      roadTiles.push({ ...tile, idx: i })
    }

    // Ball
    const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 20, 20)
    const ballMat = new THREE.MeshPhongMaterial({
      color: 0x4ECDC4, shininess: 120,
      emissive: 0x1a8a80, emissiveIntensity: 0.5, specular: 0x88ffff,
    })
    const ball = new THREE.Mesh(ballGeo, ballMat)
    ball.castShadow = true
    ball.position.set(0, BALL_RADIUS + 0.08, 0)
    scene.add(ball)
    ballLight.position.copy(ball.position)

    sceneRef.current = { renderer, scene, camera, state, ball, ballLight, roadTiles }

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
      s.speed = Math.min(2.5 + s.frameCount / 300, 9)
      s.roadWidth = Math.max(1.6, ROAD_INIT_WIDTH - s.frameCount / 500)

      // Ball physics
      const input = invertAxis(inputRef.current, invertedRef.current)
      s.ballVX += input * 0.04
      s.ballVX *= 0.84
      s.ballX += s.ballVX
      s.ballX = Math.max(-12, Math.min(12, s.ballX))

      // Advance along path
      s.pathProgress += s.speed * 0.016

      // Find which segment we're on
      const segIdx = Math.floor(s.pathProgress)
      if (segIdx >= state.path.length - 2) {
        // Extend path
        const last = state.path[state.path.length - 1]
        const ext = genPath(20, last.z)
        state.path.push(...ext.slice(1))
      }

      // Current road center X
      const seg = state.path[Math.min(segIdx, state.path.length - 2)]
      const segNext = state.path[Math.min(segIdx + 1, state.path.length - 1)]
      const t = s.pathProgress - segIdx
      const roadCenterX = seg.x + (segNext.x - seg.x) * t
      const roadCenterZ = seg.z + SEGMENT_LENGTH * t

      // Position ball
      ball.position.set(roadCenterX + s.ballX, BALL_RADIUS + 0.08, -roadCenterZ)
      ball.rotation.x += s.speed * 0.06
      ball.rotation.z -= s.ballVX * 0.5
      ballLight.position.copy(ball.position)

      // Check fall-off
      if (Math.abs(s.ballX) > s.roadWidth / 2 + 0.3) {
        s.dead = true
        sfx.gameOver()
        const finalScore = Math.floor(s.pathProgress * 3)
        submitScore(finalScore)
        setPhase('dead')
        return
      }

      // Update score
      const sc = Math.floor(s.pathProgress * 3)
      scoreRef.current = sc; setScore(sc)

      // Recycle road tiles
      roadTiles.forEach(tile => {
        const tileZ = tile.pA.z
        if (tileZ < roadCenterZ - SEGMENT_LENGTH * 3) {
          const newIdx = tile.idx + NUM_SEGMENTS
          if (newIdx < state.path.length - 1) {
            const pA = state.path[newIdx], pB = state.path[newIdx + 1]
            const mid = { x: (pA.x + pB.x) / 2, z: (pA.z + pB.z) / 2 }
            const dx = pB.x - pA.x, dz = pB.z - pA.z
            const len = Math.sqrt(dx * dx + dz * dz)
            const angle = Math.atan2(dx, dz)
            tile.mesh.rotation.z = -angle
            tile.mesh.position.set(mid.x, 0, -mid.z)
            tile.mesh.scale.y = len / SEGMENT_LENGTH
            tile.mesh.scale.x = s.roadWidth / ROAD_INIT_WIDTH
            tile.leftEdge.rotation.y = -angle
            tile.leftEdge.position.set(mid.x - Math.cos(angle) * s.roadWidth / 2, 0.11, -mid.z)
            tile.rightEdge.rotation.y = -angle
            tile.rightEdge.position.set(mid.x + Math.cos(angle) * s.roadWidth / 2, 0.11, -mid.z)
            tile.pA = pA; tile.pB = pB; tile.idx = newIdx
          }
        }
      })

      // Camera follows ball from behind and above
      const camOffset = new THREE.Vector3(0, 3.5, 5.5)
      const targetPos = ball.position.clone().add(camOffset)
      camera.position.lerp(targetPos, 0.1)
      camera.lookAt(ball.position.x * 0.3, ball.position.y, ball.position.z - 4)

      renderer.render(scene, camera)
    }
    animate()

    // Resize
    const onResize = () => {
      const W2 = mount.clientWidth, H2 = mount.clientHeight
      renderer.setSize(W2, H2)
      camera.aspect = W2 / H2; camera.updateProjectionMatrix()
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
    <div className="relative w-full h-full bg-black" style={{ touchAction: 'none' }}>
      <div ref={mountRef} className="w-full h-full" />
      <MuteButton />
      {phase === 'playing' && (
        <>
          <GameHUD score={score} mode={mode} gameId="tilt-runner" scoreUnit={game.scoreUnit} />
          {mode === 'trauma' && <TraumaIndicator isInverted={isInverted} justFlipped={justFlipped} />}
          <ControlHint hint={game.desktopHint} />
        </>
      )}
      {phase === 'countdown' && <CountdownOverlay onDone={() => setPhase('playing')} />}
      {phase === 'dead' && (
        <GameOverScreen score={score} bestScore={bestScore} isNewRecord={isNewRecord}
          scoreUnit={game.scoreUnit} mode={mode} gameId="tilt-runner"
          onRetry={() => { scoreRef.current = 0; setScore(0); setPhase('countdown') }} />
      )}
    </div>
  )
}
