import { useParams, useNavigate } from 'react-router-dom'
import { GAME_MAP } from '../data/games'
import GravityFool from '../games/GravityFool/GravityFool'
import LaneDasher from '../games/LaneDasher/LaneDasher'
import ChaosRunner from '../games/ChaosRunner/ChaosRunner'
import TiltRunner from '../games/TiltRunner/TiltRunner'
import GyroPilot from '../games/GyroPilot/GyroPilot'
import EdgeRoller from '../games/EdgeRoller/EdgeRoller'
import PlatePanic from '../games/PlatePanic/PlatePanic'
import ReflexRiot from '../games/ReflexRiot/ReflexRiot'
import TargetPanic from '../games/TargetPanic/TargetPanic'

const GAME_COMPONENTS = {
  'gravity-fool': GravityFool,
  'lane-dasher': LaneDasher,
  'chaos-runner': ChaosRunner,
  'tilt-runner': TiltRunner,
  'gyro-pilot': GyroPilot,
  'edge-roller': EdgeRoller,
  'plate-panic': PlatePanic,
  'reflex-riot': ReflexRiot,
  'target-panic': TargetPanic,
}

export default function PlayPage() {
  const { gameId, mode } = useParams()
  const navigate = useNavigate()

  if (!GAME_MAP[gameId] || !['normal', 'instinct', 'trauma'].includes(mode)) {
    navigate('/'); return null
  }
  const GameComponent = GAME_COMPONENTS[gameId]
  if (!GameComponent) { navigate('/'); return null }

  return <div className="w-full h-full"><GameComponent /></div>
}
