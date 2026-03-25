// Web Audio API-based audio manager
// Generates programmatic sounds without any audio files

let audioCtx = null
let bgGainNode = null
let sfxGainNode = null
let bgInterval = null
let isMuted = false

const getCtx = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    bgGainNode = audioCtx.createGain()
    bgGainNode.gain.value = 0.15
    bgGainNode.connect(audioCtx.destination)

    sfxGainNode = audioCtx.createGain()
    sfxGainNode.gain.value = 0.4
    sfxGainNode.connect(audioCtx.destination)
  }
  return audioCtx
}

const playNote = (freq, duration, type = 'sine', gainNode = null) => {
  if (isMuted) return
  const ctx = getCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.3, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  osc.connect(gain)
  gain.connect(gainNode || sfxGainNode)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + duration)
}

// Fun looping background music (simple generative melody)
let bgLoopRunning = false
const BG_NOTES = [261, 330, 392, 523, 392, 330, 261, 294, 349, 440, 349, 294]
let bgNoteIdx = 0

export const startBgMusic = () => {
  if (bgLoopRunning) return
  bgLoopRunning = true
  const playNext = () => {
    if (!bgLoopRunning || isMuted) { bgInterval = setTimeout(playNext, 300); return }
    const freq = BG_NOTES[bgNoteIdx % BG_NOTES.length]
    playNote(freq, 0.25, 'triangle', bgGainNode)
    bgNoteIdx++
    bgInterval = setTimeout(playNext, 280)
  }
  bgInterval = setTimeout(playNext, 100)
}

export const stopBgMusic = () => {
  bgLoopRunning = false
  clearTimeout(bgInterval)
}

export const setMuted = (muted) => {
  isMuted = muted
  if (audioCtx) {
    bgGainNode.gain.value = muted ? 0 : 0.15
    sfxGainNode.gain.value = muted ? 0 : 0.4
  }
}

export const getMuted = () => isMuted

// Sound effects
export const sfx = {
  jump: () => playNote(523, 0.15, 'square'),
  hit: () => { playNote(150, 0.3, 'sawtooth'); playNote(100, 0.4, 'square') },
  score: () => { playNote(659, 0.1, 'sine'); setTimeout(() => playNote(784, 0.15, 'sine'), 100) },
  flip: () => { playNote(440, 0.08, 'square'); setTimeout(() => playNote(220, 0.08, 'square'), 80) },
  gameOver: () => {
    [400, 300, 200, 150].forEach((f, i) => setTimeout(() => playNote(f, 0.3, 'sawtooth'), i * 150))
  },
  collect: () => { playNote(880, 0.08, 'sine'); setTimeout(() => playNote(1046, 0.12, 'sine'), 60) },
  click: () => playNote(600, 0.08, 'square'),
}

export const resumeCtx = () => {
  const ctx = getCtx()
  if (ctx.state === 'suspended') ctx.resume()
}
