// Direction inversion map
const DIRECTION_INVERSE = {
  left: 'right',
  right: 'left',
  up: 'down',
  down: 'up',
}

export const invertDirection = (dir, isInverted) => {
  if (!isInverted) return dir
  return DIRECTION_INVERSE[dir] ?? dir
}

export const invertAxis = (value, isInverted) => {
  return isInverted ? -value : value
}

export const invertKey = (key, isInverted) => {
  if (!isInverted) return key
  const map = {
    ArrowLeft: 'ArrowRight',
    ArrowRight: 'ArrowLeft',
    ArrowUp: 'ArrowDown',
    ArrowDown: 'ArrowUp',
    a: 'd', d: 'a', w: 's', s: 'w',
    A: 'D', D: 'A', W: 'S', S: 'W',
  }
  return map[key] ?? key
}

export const randomBetween = (min, max) =>
  Math.random() * (max - min) + min

export const scheduleTraumaFlip = (lastTime, nextDelay, now) => {
  return now - lastTime >= nextDelay
}
