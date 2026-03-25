import { HashRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import GameSelectPage from './pages/GameSelectPage'
import PlayPage from './pages/PlayPage'

export default function App() {
  return (
    <HashRouter>
      <div className="w-full h-full bg-bg-dark">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/game/:gameId" element={<GameSelectPage />} />
          <Route path="/play/:gameId/:mode" element={<PlayPage />} />
        </Routes>
      </div>
    </HashRouter>
  )
}
