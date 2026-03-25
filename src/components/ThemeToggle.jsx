import { useTheme } from '../context/ThemeContext'

export default function ThemeToggle() {
  const { isDark, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      className="absolute top-3 left-3 z-30 w-10 h-10 rounded-full border-2 flex items-center justify-center text-xl transition-colors"
      style={{ background: 'var(--toggle-bg)', borderColor: 'var(--card-border)' }}
      aria-label="Toggle theme"
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  )
}
