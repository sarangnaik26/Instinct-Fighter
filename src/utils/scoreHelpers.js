const SCORE_KEY = (gameId, mode) => `if_score_${gameId}_${mode}`

export const getBestScore = (gameId, mode) => {
  try {
    const stored = localStorage.getItem(SCORE_KEY(gameId, mode))
    return stored ? parseInt(stored, 10) : 0
  } catch { return 0 }
}

export const saveBestScore = (gameId, mode, score) => {
  try {
    const current = getBestScore(gameId, mode)
    if (score > current) {
      localStorage.setItem(SCORE_KEY(gameId, mode), score.toString())
      return true // new record
    }
    return false
  } catch { return false }
}

export const getAllBestScores = (gameId) => ({
  normal: getBestScore(gameId, 'normal'),
  instinct: getBestScore(gameId, 'instinct'),
  trauma: getBestScore(gameId, 'trauma'),
})

export const formatScore = (score, unit) => {
  if (!unit) return `${score}`
  return `${score} ${unit}`
}
