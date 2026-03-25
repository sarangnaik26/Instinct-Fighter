import { useState, useCallback } from 'react'
import { getBestScore, saveBestScore } from '../utils/scoreHelpers'

export const useLocalScore = (gameId, mode) => {
  const [bestScore, setBestScore] = useState(() => getBestScore(gameId, mode))
  const [isNewRecord, setIsNewRecord] = useState(false)

  const submitScore = useCallback((score) => {
    const newRecord = saveBestScore(gameId, mode, score)
    if (newRecord) {
      setBestScore(score)
      setIsNewRecord(true)
    }
    return newRecord
  }, [gameId, mode])

  return { bestScore, isNewRecord, submitScore }
}
