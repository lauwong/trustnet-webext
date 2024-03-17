/*
general functions for interacting with the DOM
*/

/*
changes curly quotes to their non-curly counterparts
*/
function uncurlify(s: string) {
  return s
    .replace(/[\u2018\u2019]/g, '\'')
    .replace(/[\u201C\u201D]/g, '"')
}

function debounce(func: Function, wait: number, immediate: boolean, ...args: any) {
  let timeout: NodeJS.Timeout | undefined
  return function () {
    // const args = arguments
    const later = function () {
      timeout = undefined
      if (!immediate)
        func.apply(this, args)
    }
    const callNow = immediate && !timeout
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
    if (callNow)
      func.apply(this, args)
  }
}

function throttle(callback: Function, limit: number, ...args: any) {
  let waiting = false // Initially, we're not waiting
  return function () { // We return a throttled function
    if (!waiting) { // If we're not waiting
      callback.apply(this, args) // Execute users function
      waiting = true // Prevent future invocations
      setTimeout(() => { // After a period of time
        waiting = false // And allow future invocations
      }, limit)
    }
  }
}

function isTextLight(rgbText: string) {
  const rgbArr = rgbText.replace('rgb(', '').replace(')', '').split(',').map(el => el.trim())
  const r = parseInt(rgbArr[0]) // extract red
  const g = parseInt(rgbArr[1]) // extract green
  const b = parseInt(rgbArr[2]) // extract blue

  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b // per ITU-R BT.709

  if (luma > 128)
    return true

  return false
}

function randomInteger(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export default {
  uncurlify,
  debounce,
  throttle,
  isTextLight,
  randomInteger,
}
