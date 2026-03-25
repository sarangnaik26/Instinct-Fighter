export const isMobileDevice = () =>
  window.matchMedia('(pointer: coarse)').matches

export const hasGyroscope = () =>
  typeof DeviceOrientationEvent !== 'undefined'

export const requestGyroPermission = async () => {
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const permission = await DeviceOrientationEvent.requestPermission()
      return permission === 'granted'
    } catch { return false }
  }
  return true // Non-iOS devices don't need permission
}
