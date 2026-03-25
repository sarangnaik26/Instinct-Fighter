import { MODE_INFO } from '../data/games'

export default function GameHUD({ score, mode, gameId, scoreUnit }) {
  const modeInfo = MODE_INFO[mode]

  return (
    <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none flex items-center justify-between px-3 pt-3">
      {/* Mode badge */}
      <div
        className="cartoon-card px-3 py-1 flex items-center gap-1 text-sm font-display"
        style={{ backgroundColor: modeInfo.bg, color: modeInfo.color, borderColor: '#000' }}
      >
        <span>{modeInfo.emoji}</span>
        <span className="hidden sm:inline">{modeInfo.label}</span>
      </div>

      {/* Score */}
      <div className="cartoon-card px-4 py-1 bg-black/60 border-white/30 text-white font-display text-lg">
        {score}{scoreUnit ? ` ${scoreUnit}` : ''}
      </div>
    </div>
  )
}
