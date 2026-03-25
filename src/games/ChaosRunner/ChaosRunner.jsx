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
const ROAD_W     = LANE_W * 3
const TILE_LEN   = 10
const NUM_TILES  = 14
const INIT_SPEED = 0.13
const OBS_TYPES  = ['jump', 'duck', 'left', 'right']

// Jump wall top Y: wall height=1.55, center at 0.78 → top=1.55
// Player jump peak: charVY=0.24, gravity=0.013 → max charY ≈ 2.2  (clears wall comfortably)
// Duck beam center Y: 1.18, half-height 0.21 → range [0.97, 1.39]
// Player standing top Y: charY(0)+1.85=1.85 → must duck (duckTop=0+0.85=0.85 < 0.97 ✓)
// Player jumping: charY rises → when charY > 1.39 (beam top), feet clear beam ✓

const BEAM_BOTTOM = 0.97   // duck beam bottom Y
const BEAM_TOP    = 1.39   // duck beam top Y
const WALL_TOP    = 1.55   // jump wall top Y

export default function ChaosRunner () {
  const { mode }  = useParams()
  const game = GAME_MAP['chaos-runner']
  const { bestScore, isNewRecord, submitScore } = useLocalScore('chaos-runner', mode)
  const mountRef    = useRef(null)
  const invertedRef = useRef(false)
  const scoreRef    = useRef(0)
  const laneRef     = useRef(1)
  const jumpRef     = useRef(false)
  const duckRef     = useRef(false)
  const coolRef     = useRef(false)
  const [phase, setPhase]       = useState('countdown')
  const [score, setScore]       = useState(0)
  const [isInverted, setIsInverted] = useState(false)
  const [justFlipped, setJustFlipped] = useState(false)

  const doAction = useCallback((dir) => {
    resumeCtx()
    const raw = invertDirection(dir, invertedRef.current)
    if ((raw === 'left' || raw === 'right') && !coolRef.current) {
      if (raw === 'left'  && laneRef.current > 0) { laneRef.current--; sfx.jump() }
      if (raw === 'right' && laneRef.current < 2) { laneRef.current++; sfx.jump() }
      coolRef.current = true; setTimeout(() => { coolRef.current = false }, 160)
    } else if (raw === 'up') {
      jumpRef.current = true; sfx.jump()
    } else if (raw === 'down') {
      duckRef.current = true; setTimeout(() => { duckRef.current = false }, 580)
    }
  }, [])

  useEffect(() => {
    let sx = 0, sy = 0
    const kd = e => {
      const m = { ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down', ' ':'up' }
      if (m[e.key]) { e.preventDefault(); doAction(m[e.key]) }
    }
    const ts = e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY }
    const te = e => {
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy
      if (Math.abs(dx) > Math.abs(dy)) doAction(dx > 0 ? 'right' : 'left')
      else doAction(dy > 0 ? 'down' : 'up')
    }
    window.addEventListener('keydown', kd)
    window.addEventListener('touchstart', ts, { passive: true })
    window.addEventListener('touchend',   te, { passive: true })
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('touchstart', ts); window.removeEventListener('touchend', te) }
  }, [doAction])

  useEffect(() => {
    if (phase !== 'playing') return
    const mount = mountRef.current; if (!mount) return
    laneRef.current = 1; jumpRef.current = false; duckRef.current = false
    coolRef.current = false; scoreRef.current = 0; invertedRef.current = false

    const W = mount.clientWidth, H = mount.clientHeight
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(W, H); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x050310)
    scene.fog = new THREE.Fog(0x050310, 22, 70)

    const camera = new THREE.PerspectiveCamera(66, W/H, 0.1, 120)
    camera.position.set(0, 3.5, 10); camera.lookAt(0, 1.2, -15)

    scene.add(new THREE.AmbientLight(0x3020aa, 0.6))
    const sun = new THREE.DirectionalLight(0xffffff, 1.1)
    sun.position.set(5, 14, 6); sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.left = -15; sun.shadow.camera.right = 15
    scene.add(sun)
    const charLight = new THREE.PointLight(0x4ECDC4, 2, 8); scene.add(charLight)

    // ── Road tiles ──────────────────────────────────
    const surfMat = new THREE.MeshLambertMaterial({ color: 0x14142e })
    const kerbL   = new THREE.MeshPhongMaterial({ color: 0xf39c12, emissive: 0x7a4a00, shininess: 80 })
    const kerbR   = new THREE.MeshPhongMaterial({ color: 0x8e44ad, emissive: 0x3a0060, shininess: 80 })
    const divMat  = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.13 })

    const roadTiles = []
    for (let i = 0; i < NUM_TILES; i++) {
      const g = new THREE.Group()
      const surf = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W, 0.18, TILE_LEN), surfMat)
      surf.receiveShadow = true; g.add(surf)
      ;[-LANE_W/2, LANE_W/2].forEach(dx => {
        const d = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, TILE_LEN*0.55), divMat)
        d.position.set(dx, 0.1, 0); g.add(d)
      })
      const kL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.4, TILE_LEN), kerbL); kL.position.set(-ROAD_W/2-0.14, 0.2, 0); g.add(kL)
      const kR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.4, TILE_LEN), kerbR); kR.position.set( ROAD_W/2+0.14, 0.2, 0); g.add(kR)
      g.position.z = -i * TILE_LEN; scene.add(g); roadTiles.push(g)
    }

    // Buildings (recycled)
    const bMat = new THREE.MeshLambertMaterial({ color: 0x0c0820 })
    const wMat = new THREE.MeshBasicMaterial({ color: 0xffe66d, transparent: true, opacity: 0.7 })
    const NBLD = 10; const buildings = []
    for (let i = 0; i < NBLD; i++) {
      const side = i%2===0?-1:1
      const bw=3.5+(i*0.7)%3, bh=7+(i*1.3)%9, bd=3.5
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw,bh,bd), bMat)
      b.position.set(side*(ROAD_W/2+bw/2+2), bh/2, -i*(130/NBLD)-5)
      scene.add(b)
      const top = new THREE.Mesh(new THREE.BoxGeometry(bw,0.2,bd),
        new THREE.MeshBasicMaterial({ color: side>0?0xf39c12:0x8e44ad }))
      top.position.y = bh/2+0.1; b.add(top)
      for (let wy=-bh/2+1; wy<bh/2-0.5; wy+=1.9) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(0.5,0.7), wMat)
        const fx = side>0?-bw/2-0.01:bw/2+0.01
        w.position.set(fx,wy,0); w.rotation.y = side>0?Math.PI/2:-Math.PI/2; b.add(w)
      }
      buildings.push({ mesh: b, spacing: 130/NBLD })
    }

    // ── Character ───────────────────────────────────
    const charGroup = new THREE.Group(); scene.add(charGroup)
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.72,0.9,0.46),
      new THREE.MeshPhongMaterial({ color:0x4ECDC4, shininess:80, emissive:0x1a8a80, emissiveIntensity:0.2 }))
    bodyMesh.position.y = 1.05; bodyMesh.castShadow = true; charGroup.add(bodyMesh)
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.33,16,16),
      new THREE.MeshPhongMaterial({ color:0xFFE66D, shininess:80 }))
    headMesh.position.y = 1.78; headMesh.castShadow = true; charGroup.add(headMesh)
    ;[-0.13,0.13].forEach(ex => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.06,8,8), new THREE.MeshBasicMaterial({color:0x111111}))
      e.position.set(ex,1.82,0.28); charGroup.add(e)
    })
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.21,0.07,8,16),
      new THREE.MeshPhongMaterial({color:0xFF6B6B}))
    scarf.position.set(0,1.5,0); scarf.rotation.x=Math.PI/2; charGroup.add(scarf)
    ;[-0.47,0.47].forEach(ax=>{
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.5,0.18), new THREE.MeshPhongMaterial({color:0x4ECDC4}))
      a.position.set(ax,1.0,0); charGroup.add(a)
    })
    const legMat = new THREE.MeshPhongMaterial({color:0x1a5276})
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22,0.68,0.22), legMat); legL.position.set(-0.22,0.34,0); legL.castShadow=true; charGroup.add(legL)
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22,0.68,0.22), legMat); legR.position.set( 0.22,0.34,0); legR.castShadow=true; charGroup.add(legR)
    charGroup.position.set(LANES[1], 0, 7)

    // ── Obstacles ───────────────────────────────────
    const obstacles = []
    const makeObs = (type, laneIdx, z) => {
      const g = new THREE.Group()
      const colors = { jump:0xe74c3c, duck:0xf39c12, left:0x8e44ad, right:0x2980b9 }
      const col = colors[type]
      const mat = new THREE.MeshPhongMaterial({ color:col, shininess:80, emissive:col, emissiveIntensity:0.2 })
      const glow = new THREE.PointLight(col, 1.8, 6); g.add(glow)

      if (type === 'jump') {
        // Wall: height=1.55, top at 1.55, player must clear charY > WALL_TOP via jump
        const wall = new THREE.Mesh(new THREE.BoxGeometry(LANE_W*0.8, 1.55, 0.62), mat)
        wall.position.y = 1.55/2; wall.castShadow=true; g.add(wall)
        // Glowing cap
        const cap = new THREE.Mesh(new THREE.BoxGeometry(LANE_W*0.82, 0.16, 0.64),
          new THREE.MeshBasicMaterial({color:col}))
        cap.position.y = 1.63; g.add(cap)
        // Arrow pointing up
        const arrMat = new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.9})
        const arrBody = new THREE.Mesh(new THREE.BoxGeometry(0.14,0.5,0.05), arrMat)
        arrBody.position.set(0,0.85,0.33); g.add(arrBody)
        const arrHead = new THREE.Mesh(new THREE.ConeGeometry(0.22,0.28,4), arrMat)
        arrHead.position.set(0,1.22,0.33); g.add(arrHead)
        glow.position.y = 1.0

      } else if (type === 'duck') {
        // Beam spans all lanes: center Y=1.18, half=0.21 → range [0.97, 1.39]
        const beam = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W+0.8, 0.42, 0.62), mat)
        beam.position.y = 1.18; beam.castShadow=true; g.add(beam)
        // Warning stripes
        for (let si=0; si<6; si++) {
          const s = new THREE.Mesh(new THREE.BoxGeometry(0.32,0.44,0.64),
            new THREE.MeshBasicMaterial({color:si%2===0?0xffd700:0x000000, transparent:true, opacity:0.28}))
          s.position.set(-ROAD_W/2+0.4+si*1.65, 1.18, 0); g.add(s)
        }
        // Arrow pointing down
        const arrMat = new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.9})
        const arrB = new THREE.Mesh(new THREE.BoxGeometry(0.14,0.4,0.05), arrMat)
        arrB.position.set(0,0.72,0.34); g.add(arrB)
        const arrH = new THREE.Mesh(new THREE.ConeGeometry(0.2,0.25,4), arrMat)
        arrH.position.set(0,0.42,0.34); arrH.rotation.z=Math.PI; g.add(arrH)
        glow.position.y = 1.18

      } else {
        // Lane block (left=right lane, right=left lane)
        const block = new THREE.Mesh(new THREE.BoxGeometry(LANE_W*0.78,1.25,0.9), mat)
        block.position.y = 0.625; block.castShadow=true; g.add(block)
        const rim = new THREE.Mesh(new THREE.BoxGeometry(LANE_W*0.8,0.14,0.92),
          new THREE.MeshBasicMaterial({color:col}))
        rim.position.y = 1.32; g.add(rim)
        const arrMat = new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.9})
        const arrB = new THREE.Mesh(new THREE.BoxGeometry(0.45,0.12,0.05), arrMat)
        arrB.position.set(0,0.72,0.47); g.add(arrB)
        const arrH = new THREE.Mesh(new THREE.ConeGeometry(0.18,0.24,4), arrMat)
        arrH.position.set(type==='left'?-0.3:0.3, 0.72, 0.47)
        arrH.rotation.z = type==='left'?Math.PI/2:-Math.PI/2; g.add(arrH)
        glow.position.y = 0.7
      }

      const lx = type==='duck' ? 0 : type==='left' ? LANES[2] : type==='right' ? LANES[0] : LANES[laneIdx]
      g.position.set(lx, 0, z); scene.add(g)
      obstacles.push({ group:g, type, lane: type==='left'?2 : type==='right'?0 : laneIdx })
    }
    for (let i=0;i<5;i++) {
      const t=OBS_TYPES[Math.floor(Math.random()*4)]
      const l=t==='left'?2:t==='right'?0:Math.floor(Math.random()*3)
      makeObs(t,l,-22-i*14)
    }

    // ── Game state ──────────────────────────────────
    const gs = {
      charX:LANES[1], targetX:LANES[1],
      charY:0, charVY:0, isJumping:false, isDucking:false,
      bobAngle:0, speed:INIT_SPEED, worldZ:0, lastSpawn:-28,
      lastTraumaFlip:Date.now(), nextTraumaDelay:randomBetween(2500,7000),
      dead:false, frameCount:0,
    }

    let animId
    const animate = () => {
      animId = requestAnimationFrame(animate)
      if (gs.dead) return
      const now = Date.now()

      if (mode==='trauma') {
        if (now-gs.lastTraumaFlip>gs.nextTraumaDelay) {
          invertedRef.current=!invertedRef.current
          setIsInverted(invertedRef.current); setJustFlipped(true)
          setTimeout(()=>setJustFlipped(false),500); sfx.flip()
          gs.lastTraumaFlip=now; gs.nextTraumaDelay=randomBetween(2500,7000)
        }
      } else invertedRef.current = mode==='instinct'

      gs.frameCount++
      gs.speed = Math.min(INIT_SPEED + gs.frameCount/4500, 0.50)
      gs.worldZ += gs.speed

      // Lane
      gs.targetX = LANES[laneRef.current]
      gs.charX += (gs.targetX - gs.charX) * 0.14
      charGroup.position.x = gs.charX

      // Jump
      if (jumpRef.current && !gs.isJumping) { gs.isJumping=true; gs.charVY=0.24; jumpRef.current=false }
      if (gs.isJumping) {
        gs.charY += gs.charVY; gs.charVY -= 0.013
        if (gs.charY <= 0) { gs.charY=0; gs.isJumping=false; gs.charVY=0 }
      }

      // Duck
      gs.isDucking = duckRef.current
      const duckScale = gs.isDucking ? 0.48 : 1.0
      charGroup.scale.y += (duckScale - charGroup.scale.y) * 0.2
      charGroup.position.y = gs.charY

      // Legs
      gs.bobAngle += gs.speed*9
      legL.rotation.x =  Math.sin(gs.bobAngle)*0.65
      legR.rotation.x = -Math.sin(gs.bobAngle)*0.65
      charLight.position.set(gs.charX, 2.5, 7)

      const scrollD = gs.speed*60*0.016

      // Scroll road
      roadTiles.forEach(t => {
        t.position.z += scrollD
        if (t.position.z > 14) t.position.z -= NUM_TILES*TILE_LEN
      })

      // Scroll buildings
      buildings.forEach(b => {
        b.mesh.position.z += scrollD * 0.55
        if (b.mesh.position.z > 16) b.mesh.position.z -= b.spacing * NBLD + 20
      })

      // Move obstacles
      obstacles.forEach(o => { o.group.position.z += scrollD })
      for (let i=obstacles.length-1;i>=0;i--) {
        if (obstacles[i].group.position.z > 16) { scene.remove(obstacles[i].group); obstacles.splice(i,1) }
      }

      // Spawn
      const interval = Math.max(7, 16 - gs.frameCount/230)
      if (gs.worldZ - gs.lastSpawn > interval) {
        const t = OBS_TYPES[Math.floor(Math.random()*4)]
        const l = t==='left'?2:t==='right'?0:Math.floor(Math.random()*3)
        makeObs(t, l, -55)
        gs.lastSpawn = gs.worldZ
      }

      scoreRef.current = Math.floor(gs.worldZ*2); setScore(scoreRef.current)

      // ── COLLISION ────────────────────────────────
      // charY = feet Y, charTop = head Y
      const charFeet = gs.charY
      const charTop  = gs.charY + (gs.isDucking ? 0.85 : 1.85)

      const hit = obstacles.some(o => {
        const dz = Math.abs(o.group.position.z - charGroup.position.z)
        if (dz > 1.8) return false

        if (o.type === 'jump') {
          // Wall spans Y [0, WALL_TOP=1.55]
          // Hit if: in same lane AND charFeet < WALL_TOP AND not jumping clear
          const dx = Math.abs(o.group.position.x - gs.charX)
          if (dx > LANE_W*0.38) return false
          // Safe if feet are above wall top (jumped over)
          return charFeet < WALL_TOP
        } else if (o.type === 'duck') {
          // Beam Y range [BEAM_BOTTOM=0.97, BEAM_TOP=1.39]
          // Hit if character body overlaps beam Y range AND not ducking clear
          // Character Y range: [charFeet, charTop]
          // Overlap: charFeet < BEAM_TOP && charTop > BEAM_BOTTOM
          if (gs.isDucking) return false  // ducking always clears beam
          // Not ducking: charTop = charY+1.85. Safe only if feet above beam top (jumping high)
          return charFeet < BEAM_TOP && charTop > BEAM_BOTTOM
        } else {
          // Side block — check lane proximity only
          const dx = Math.abs(o.group.position.x - gs.charX)
          return dx < LANE_W*0.37
        }
      })

      if (hit) { gs.dead=true; sfx.gameOver(); submitScore(scoreRef.current); setPhase('dead'); return }

      camera.position.x += (gs.charX*0.13 - camera.position.x)*0.05
      camera.fov = 66 + (gs.speed-INIT_SPEED)/(0.5-INIT_SPEED)*9; camera.updateProjectionMatrix()
      camera.lookAt(gs.charX*0.08, 1.2, -11)
      scene.fog.far = Math.max(28, 70 - (gs.speed-INIT_SPEED)/(0.5-INIT_SPEED)*30)

      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      const W2=mount.clientWidth, H2=mount.clientHeight
      renderer.setSize(W2,H2); camera.aspect=W2/H2; camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(animId); window.removeEventListener('resize', onResize)
      renderer.dispose(); if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [phase, mode])

  const startGame = useCallback(() => { setPhase('playing') }, [])

  return (
    <div className="relative w-full h-full bg-black" style={{ touchAction: 'none' }}>
      <div ref={mountRef} className="w-full h-full" />
      <MuteButton />
      {phase === 'playing' && (
        <>
          <GameHUD score={score} mode={mode} gameId="chaos-runner" scoreUnit={game.scoreUnit} />
          <div className="absolute top-14 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none">
            {[{label:'↑ JUMP',color:'#e74c3c'},{label:'↓ DUCK',color:'#f39c12'},{label:'← → DODGE',color:'#a29bfe'}].map(h=>(
              <div key={h.label} className="px-2 py-0.5 rounded-lg font-display text-xs border border-black/50"
                style={{background:'rgba(0,0,0,0.6)',color:h.color}}>{h.label}</div>
            ))}
          </div>
          {mode === 'trauma' && <TraumaIndicator isInverted={isInverted} justFlipped={justFlipped} />}
          <ControlHint hint={game.desktopHint} />
        </>
      )}
      {phase === 'countdown' && <CountdownOverlay onDone={startGame} />}
      {phase === 'dead' && (
        <GameOverScreen score={score} bestScore={bestScore} isNewRecord={isNewRecord}
          scoreUnit={game.scoreUnit} mode={mode} gameId="chaos-runner"
          onRetry={() => { scoreRef.current=0; setScore(0); setPhase('countdown') }} />
      )}
    </div>
  )
}
