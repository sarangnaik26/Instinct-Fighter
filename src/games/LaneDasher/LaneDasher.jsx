import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import * as THREE from 'three'
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

const LANES      = [-3.2, 0, 3.2]
const LANE_W     = 3.2
const ROAD_W     = LANE_W * 3          // 9.6
const TILE_LEN   = 10                  // each road tile length
const NUM_ROAD_TILES = 14              // enough to fill ~140 units of view
const INIT_SPEED = 0.14
const OBS_COLS   = [0xe74c3c, 0xe67e22, 0x8e44ad, 0x2980b9]

export default function LaneDasher () {
  const { mode } = useParams()
  const game = GAME_MAP['lane-dasher']
  const { bestScore, isNewRecord, submitScore } = useLocalScore('lane-dasher', mode)
  const mountRef   = useRef(null)
  const invertedRef = useRef(false)
  const scoreRef   = useRef(0)
  const laneRef    = useRef(1)
  const coolRef    = useRef(false)
  const [phase, setPhase]       = useState('countdown')
  const [score, setScore]       = useState(0)
  const [isInverted, setIsInverted] = useState(false)
  const [justFlipped, setJustFlipped] = useState(false)

  const move = useCallback((dir) => {
    if (coolRef.current) return
    resumeCtx()
    const raw = invertDirection(dir, invertedRef.current)
    if (raw === 'left'  && laneRef.current > 0) { laneRef.current--; sfx.jump() }
    if (raw === 'right' && laneRef.current < 2) { laneRef.current++; sfx.jump() }
    coolRef.current = true
    setTimeout(() => { coolRef.current = false }, 160)
  }, [])

  useEffect(() => {
    let sx = 0
    const kd = e => { if (e.key === 'ArrowLeft') move('left'); if (e.key === 'ArrowRight') move('right') }
    const ts = e => { sx = e.touches[0].clientX }
    const te = e => { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 28) move(dx > 0 ? 'right' : 'left') }
    window.addEventListener('keydown', kd)
    window.addEventListener('touchstart', ts, { passive: true })
    window.addEventListener('touchend',   te, { passive: true })
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('touchstart', ts); window.removeEventListener('touchend', te) }
  }, [move])

  useEffect(() => {
    if (phase !== 'playing') return
    const mount = mountRef.current; if (!mount) return
    laneRef.current = 1; scoreRef.current = 0; invertedRef.current = false

    const W = mount.clientWidth, H = mount.clientHeight
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(W, H); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x05020e)
    scene.fog = new THREE.Fog(0x05020e, 25, 75)

    const camera = new THREE.PerspectiveCamera(68, W / H, 0.1, 120)
    camera.position.set(0, 3.5, 10); camera.lookAt(0, 1.2, -15)

    // ── Lights ──────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x3030aa, 0.6))
    const sun = new THREE.DirectionalLight(0xffffff, 1.1)
    sun.position.set(5, 14, 6); sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.left = -15; sun.shadow.camera.right = 15
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 50
    scene.add(sun)
    const charLight = new THREE.PointLight(0x4ECDC4, 2.0, 8); scene.add(charLight)
    const leftStrip  = new THREE.PointLight(0xff2255, 0.8, 12); leftStrip.position.set(-ROAD_W/2, 0.1, 0); scene.add(leftStrip)
    const rightStrip = new THREE.PointLight(0x2255ff, 0.8, 12); rightStrip.position.set( ROAD_W/2, 0.1, 0); scene.add(rightStrip)

    // ── Road tiles (recycled pool) ──────────────────
    // Each tile = road surface + 2 lane lines + left kerb + right kerb
    const roadSurfMat = new THREE.MeshLambertMaterial({ color: 0x18183a })
    const kerbMatL    = new THREE.MeshPhongMaterial({ color: 0xff2255, emissive: 0x880011, shininess: 80 })
    const kerbMatR    = new THREE.MeshPhongMaterial({ color: 0x2255ff, emissive: 0x001188, shininess: 80 })
    const divMat      = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 })

    const roadTiles = []
    for (let i = 0; i < NUM_ROAD_TILES; i++) {
      const g = new THREE.Group()
      const surf = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W, 0.18, TILE_LEN), roadSurfMat)
      surf.receiveShadow = true; g.add(surf)
      // Two lane divider dashes
      ;[-LANE_W/2, LANE_W/2].forEach(dx => {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, TILE_LEN * 0.55), divMat)
        dash.position.set(dx, 0.1, 0); g.add(dash)
      })
      // Neon kerbs
      const kL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.4, TILE_LEN), kerbMatL)
      kL.position.set(-ROAD_W/2 - 0.14, 0.2, 0); g.add(kL)
      const kR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.4, TILE_LEN), kerbMatR)
      kR.position.set( ROAD_W/2 + 0.14, 0.2, 0); g.add(kR)
      // Underside (depth)
      const under = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W + 0.6, 0.6, TILE_LEN), new THREE.MeshLambertMaterial({ color: 0x0a0820 }))
      under.position.y = -0.38; g.add(under)
      g.position.z = -i * TILE_LEN
      scene.add(g)
      roadTiles.push(g)
    }

    // Ground plane (far sides)
    const gndMat = new THREE.MeshLambertMaterial({ color: 0x03010a })
    ;[-ROAD_W - 8, ROAD_W + 8].forEach(x => {
      const gnd = new THREE.Mesh(new THREE.PlaneGeometry(16, 300), gndMat)
      gnd.rotation.x = -Math.PI / 2; gnd.position.set(x, -0.1, -140); scene.add(gnd)
    })

    // ── Buildings (recycled) ─────────────────────────
    const bldMat  = new THREE.MeshLambertMaterial({ color: 0x0e0820 })
    const winMat  = new THREE.MeshBasicMaterial({ color: 0xffe66d, transparent: true, opacity: 0.75 })
    const winMatB = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.55 })
    const NUM_BLDS = 10
    const buildings = []
    for (let i = 0; i < NUM_BLDS; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const bw = 3.5 + (i * 0.7) % 3, bh = 7 + (i * 1.3) % 9, bd = 3.5
      const bld = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), bldMat)
      bld.position.set(side * (ROAD_W/2 + bw/2 + 1.8), bh/2, -i * (140/NUM_BLDS) - 5)
      bld.castShadow = true; scene.add(bld)
      // Neon top strip
      const topMat = new THREE.MeshBasicMaterial({ color: side > 0 ? 0x2255ff : 0xff2255 })
      const top = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.18, bd), topMat)
      top.position.y = bh/2 + 0.09; bld.add(top)
      // Window grid
      const wins = []
      for (let wy = -bh/2+1; wy < bh/2-0.5; wy += 1.8) {
        for (let wz = -bd/2+0.6; wz < bd/2; wz += 1.3) {
          const wm = Math.random() > 0.3 ? winMat : winMatB
          const w = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.75), wm)
          const fx = side > 0 ? -bw/2 - 0.01 : bw/2 + 0.01
          w.position.set(fx, wy, wz); w.rotation.y = side > 0 ? Math.PI/2 : -Math.PI/2
          bld.add(w); wins.push(w)
        }
      }
      buildings.push({ mesh: bld, side, bw, bh, startZ: bld.position.z })
    }

    // ── Stars ────────────────────────────────────────
    const starGeo = new THREE.BufferGeometry()
    const sv = []
    for (let i = 0; i < 500; i++) sv.push((Math.random()-0.5)*140, Math.random()*30+4, (Math.random()-0.5)*220)
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sv, 3))
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.14 })))

    // ── Character ────────────────────────────────────
    const charGroup = new THREE.Group(); scene.add(charGroup)
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.92, 0.46),
      new THREE.MeshPhongMaterial({ color: 0x4ECDC4, shininess: 80, emissive: 0x1a8a80, emissiveIntensity: 0.2 }))
    bodyMesh.position.y = 1.06; bodyMesh.castShadow = true; charGroup.add(bodyMesh)
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.33, 16, 16),
      new THREE.MeshPhongMaterial({ color: 0xFFE66D, shininess: 80 }))
    headMesh.position.y = 1.80; headMesh.castShadow = true; charGroup.add(headMesh)
    // Eyes
    ;[-0.13, 0.13].forEach(ex => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: 0x111111 }))
      e.position.set(ex, 1.84, 0.28); charGroup.add(e)
    })
    // Scarf
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 8, 16),
      new THREE.MeshPhongMaterial({ color: 0xFF6B6B, shininess: 60 }))
    scarf.position.set(0, 1.52, 0); scarf.rotation.x = Math.PI/2; charGroup.add(scarf)
    // Arms
    ;[-0.48, 0.48].forEach(ax => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18),
        new THREE.MeshPhongMaterial({ color: 0x4ECDC4 }))
      arm.position.set(ax, 1.0, 0); charGroup.add(arm)
    })
    // Legs
    const legMat = new THREE.MeshPhongMaterial({ color: 0x1a5276 })
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.68, 0.22), legMat)
    legL.position.set(-0.22, 0.34, 0); legL.castShadow = true; charGroup.add(legL)
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.68, 0.22), legMat)
    legR.position.set( 0.22, 0.34, 0); legR.castShadow = true; charGroup.add(legR)
    charGroup.position.set(LANES[1], 0, 7)

    // ── Obstacles ───────────────────────────────────
    const obstacles = []
    const makeObs = (laneIdx, z) => {
      const kind = Math.floor(Math.random() * 4)
      const col  = OBS_COLS[kind]
      const g = new THREE.Group()
      const mat = new THREE.MeshPhongMaterial({ color: col, shininess: 80, emissive: col, emissiveIntensity: 0.18 })

      if (kind === 0) {
        // Subway train — tall, fills lane
        const body = new THREE.Mesh(new THREE.BoxGeometry(LANE_W*0.82, 1.55, 2.8), mat)
        body.position.y = 0.78; body.castShadow = true; g.add(body)
        const roof = new THREE.Mesh(new THREE.BoxGeometry(LANE_W*0.84, 0.2, 2.82),
          new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 }))
        roof.position.y = 1.65; g.add(roof)
        const win = new THREE.Mesh(new THREE.PlaneGeometry(LANE_W*0.58, 0.55),
          new THREE.MeshBasicMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.8, side: THREE.DoubleSide }))
        win.position.set(0, 1.05, 1.42); g.add(win)
      } else if (kind === 1) {
        // Barrier — chunky roadblock
        const b = new THREE.Mesh(new THREE.BoxGeometry(LANE_W*0.76, 1.0, 0.65), mat)
        b.position.y = 0.5; b.castShadow = true; g.add(b)
        for (let si = 0; si < 3; si++) {
          const s = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.02, 0.67),
            new THREE.MeshBasicMaterial({ color: si%2===0 ? 0x000000 : 0xffffff, transparent: true, opacity: 0.22 }))
          s.position.set(-LANE_W*0.24 + si*LANE_W*0.24, 0.51, 0); g.add(s)
        }
      } else if (kind === 2) {
        // Glowing wall pillar
        const w = new THREE.Mesh(new THREE.BoxGeometry(LANE_W*0.72, 1.2, 0.72), mat)
        w.position.y = 0.6; w.castShadow = true; g.add(w)
        const top = new THREE.Mesh(new THREE.BoxGeometry(LANE_W*0.74, 0.18, 0.74),
          new THREE.MeshBasicMaterial({ color: col }))
        top.position.y = 1.29; g.add(top)
        // Point glow on obstacle
        const glow = new THREE.PointLight(col, 1.5, 5)
        glow.position.y = 1.2; g.add(glow)
      } else {
        // Wide barricade
        const w = new THREE.Mesh(new THREE.BoxGeometry(LANE_W*0.88, 0.78, 1.1), mat)
        w.position.y = 0.39; w.castShadow = true; g.add(w)
        const rim = new THREE.Mesh(new THREE.BoxGeometry(LANE_W*0.9, 0.12, 1.12),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }))
        rim.position.y = 0.84; g.add(rim)
      }
      g.position.set(LANES[laneIdx], 0, z)
      scene.add(g)
      obstacles.push({ group: g, lane: laneIdx, kind })
    }
    for (let i = 0; i < 5; i++) makeObs(Math.floor(Math.random() * 3), -22 - i * 14)

    // ── Game state ───────────────────────────────────
    const gs = {
      runnerX: LANES[1], targetX: LANES[1],
      bobAngle: 0, speed: INIT_SPEED,
      worldZ: 0, lastSpawn: -28,
      lastTraumaFlip: Date.now(), nextTraumaDelay: randomBetween(2500, 7000),
      dead: false, frameCount: 0,
    }

    let animId
    const animate = () => {
      animId = requestAnimationFrame(animate)
      if (gs.dead) return
      const now = Date.now()

      if (mode === 'trauma') {
        if (now - gs.lastTraumaFlip > gs.nextTraumaDelay) {
          invertedRef.current = !invertedRef.current
          setIsInverted(invertedRef.current); setJustFlipped(true)
          setTimeout(() => setJustFlipped(false), 500); sfx.flip()
          gs.lastTraumaFlip = now; gs.nextTraumaDelay = randomBetween(2500, 7000)
        }
      } else invertedRef.current = mode === 'instinct'

      gs.frameCount++
      // Gradual speed ramp: starts slow, grows over time
      gs.speed = Math.min(INIT_SPEED + gs.frameCount / 4200, 0.52)
      gs.worldZ += gs.speed

      // Character lateral snap
      gs.targetX = LANES[laneRef.current]
      gs.runnerX += (gs.targetX - gs.runnerX) * 0.14
      gs.bobAngle += gs.speed * 9
      charGroup.position.x = gs.runnerX
      charGroup.position.y = Math.abs(Math.sin(gs.bobAngle)) * 0.12
      legL.rotation.x =  Math.sin(gs.bobAngle) * 0.65
      legR.rotation.x = -Math.sin(gs.bobAngle) * 0.65
      charLight.position.set(gs.runnerX, 2.5, 7)

      // ── Scroll road tiles ────────────────────────
      // Each tile moves forward; when it passes the camera, recycle to back
      const scrollDist = gs.speed * 60 * 0.016
      roadTiles.forEach(t => {
        t.position.z += scrollDist
        if (t.position.z > 14) t.position.z -= NUM_ROAD_TILES * TILE_LEN
      })

      // ── Scroll buildings (parallax slower) ────────
      buildings.forEach(b => {
        b.mesh.position.z += scrollDist * 0.55
        if (b.mesh.position.z > 16) b.mesh.position.z -= NUM_BLDS * (140/NUM_BLDS) + 20
      })
      leftStrip.position.z  = charGroup.position.z
      rightStrip.position.z = charGroup.position.z

      // ── Move obstacles ────────────────────────────
      obstacles.forEach(o => { o.group.position.z += scrollDist })
      for (let i = obstacles.length - 1; i >= 0; i--) {
        if (obstacles[i].group.position.z > 16) {
          scene.remove(obstacles[i].group); obstacles.splice(i, 1)
        }
      }

      // ── Spawn new obstacles ───────────────────────
      const interval = Math.max(7, 17 - gs.frameCount / 220)
      if (gs.worldZ - gs.lastSpawn > interval) {
        makeObs(Math.floor(Math.random() * 3), -55)
        gs.lastSpawn = gs.worldZ
      }

      // ── Score ─────────────────────────────────────
      scoreRef.current = Math.floor(gs.worldZ * 2.2); setScore(scoreRef.current)

      // ── Collision ─────────────────────────────────
      const hit = obstacles.some(o => {
        const dx = Math.abs(o.group.position.x - gs.runnerX)
        const dz = Math.abs(o.group.position.z - charGroup.position.z)
        const hitW = o.kind === 0 ? LANE_W*0.40 : LANE_W*0.38
        const hitD = o.kind === 0 ? 2.0 : 1.4
        return dx < hitW && dz < hitD
      })
      if (hit) { gs.dead = true; sfx.gameOver(); submitScore(scoreRef.current); setPhase('dead'); return }

      // ── Camera lean ───────────────────────────────
      camera.position.x += (gs.runnerX * 0.14 - camera.position.x) * 0.06
      const speedFrac = (gs.speed - INIT_SPEED) / (0.52 - INIT_SPEED)
      camera.fov = 68 + speedFrac * 9; camera.updateProjectionMatrix()
      camera.lookAt(gs.runnerX * 0.1, 1.2, -12)
      scene.fog.far = Math.max(32, 75 - speedFrac * 30)

      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      const W2 = mount.clientWidth, H2 = mount.clientHeight
      renderer.setSize(W2, H2); camera.aspect = W2/H2; camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(animId); window.removeEventListener('resize', onResize)
      renderer.dispose(); if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [phase, mode])

  const startGame = useCallback(() => { setPhase('playing') }, [])

  // Speed in km/h: derived directly from internal speed multiplier
  const kmh = Math.floor(30 + score * 0.04)

  return (
    <div className="relative w-full h-full bg-black" style={{ touchAction: 'none' }}>
      <div ref={mountRef} className="w-full h-full" />
      <MuteButton />
      {phase === 'playing' && (
        <>
          <GameHUD score={score} mode={mode} gameId="lane-dasher" scoreUnit={game.scoreUnit} />
          <div className="absolute bottom-4 right-4 cartoon-card px-3 py-1 bg-black/70 border-yellow-400 font-display text-yellow-300 text-sm">
            ⚡ {kmh} km/h
          </div>
          {mode === 'trauma' && <TraumaIndicator isInverted={isInverted} justFlipped={justFlipped} />}
          <ControlHint hint={game.desktopHint} />
        </>
      )}
      {phase === 'countdown' && <CountdownOverlay onDone={startGame} />}
      {phase === 'dead' && (
        <GameOverScreen score={score} bestScore={bestScore} isNewRecord={isNewRecord}
          scoreUnit={game.scoreUnit} mode={mode} gameId="lane-dasher"
          onRetry={() => { scoreRef.current=0; setScore(0); setPhase('countdown') }} />
      )}
    </div>
  )
}
