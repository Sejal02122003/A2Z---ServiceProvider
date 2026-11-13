import alertSoundSrc from '../assets/alert.mp3'

let audioElement = null
let audioContext = null
let isPlaying = false
let isUnlocked = false

/**
 * Safely call navigator.vibrate respecting Chrome user activation policy.
 * Chrome blocks navigator.vibrate if user has not tapped/clicked the frame yet.
 */
function safeVibrate(pattern) {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
  if (typeof navigator.userActivation !== 'undefined' && !navigator.userActivation.hasBeenActive) {
    return
  }
  try {
    navigator.vibrate(pattern)
  } catch {
    /* ignore */
  }
}

/**
 * Initializes and unlocks AudioContext and HTML5 Audio element on first user interaction.
 * Required by modern browser autoplay policies so sound can play when bookings arrive (in and out of app).
 */
export function unlockAudioContext() {
  if (isUnlocked) return

  try {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext
    if (AudioCtxClass && (!audioContext || audioContext.state === 'closed')) {
      audioContext = new AudioCtxClass()
    }
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {})
    }

    if (!audioElement) {
      audioElement = new Audio(alertSoundSrc)
      audioElement.preload = 'auto'
      audioElement.volume = 1.0
    }

    // Play and immediately pause a silent fraction to unlock HTML5 Audio in browsers
    const p = audioElement.play()
    if (p !== undefined) {
      p.then(() => {
        if (!isPlaying) {
          audioElement.pause()
          audioElement.currentTime = 0
        }
        isUnlocked = true
      }).catch(() => {
        // Autoplay policy waiting for click/touch
      })
    }
  } catch (err) {
    console.warn('[BookingSound] Unlock attempt warning:', err)
  }
}

// Auto-register one-time unlock listeners on user interaction
if (typeof window !== 'undefined') {
  const handleFirstInteraction = () => {
    unlockAudioContext()
    window.removeEventListener('click', handleFirstInteraction, true)
    window.removeEventListener('touchstart', handleFirstInteraction, true)
    window.removeEventListener('keydown', handleFirstInteraction, true)
  }
  window.addEventListener('click', handleFirstInteraction, true)
  window.addEventListener('touchstart', handleFirstInteraction, true)
  window.addEventListener('keydown', handleFirstInteraction, true)
}

/**
 * Play synthesizer backup chime using Web Audio API
 */
function playWebAudioChime() {
  try {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext
    if (!AudioCtxClass) return
    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new AudioCtxClass()
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {})
    }
    const now = audioContext.currentTime

    const osc1 = audioContext.createOscillator()
    const gain1 = audioContext.createGain()
    osc1.type = 'triangle'
    osc1.frequency.setValueAtTime(880, now) // A5
    gain1.gain.setValueAtTime(0.4, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
    osc1.connect(gain1)
    gain1.connect(audioContext.destination)
    osc1.start(now)
    osc1.stop(now + 0.25)

    const osc2 = audioContext.createOscillator()
    const gain2 = audioContext.createGain()
    osc2.type = 'triangle'
    osc2.frequency.setValueAtTime(1174.66, now + 0.18) // D6
    gain2.gain.setValueAtTime(0.45, now + 0.18)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
    osc2.connect(gain2)
    gain2.connect(audioContext.destination)
    osc2.start(now + 0.18)
    osc2.stop(now + 0.5)
  } catch (err) {
    console.warn('[BookingSound] Synthesizer chime error:', err)
  }
}

/**
 * Start looping the booking alert sound (in-app and background).
 */
export function playBookingAlertSound() {
  isPlaying = true

  try {
    if (!audioElement) {
      audioElement = new Audio(alertSoundSrc)
      audioElement.preload = 'auto'
      audioElement.volume = 1.0
    }

    audioElement.loop = true
    audioElement.currentTime = 0

    const playPromise = audioElement.play()
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('[BookingSound] Play was prevented by browser autoplay policy:', err?.message || err)
        // Ensure chime plays as immediate fallback
        playWebAudioChime()
      })
    }
  } catch (err) {
    console.warn('[BookingSound] Audio play error:', err)
  }

  // Also play chime for crisp initial alert
  playWebAudioChime()

  // Trigger vibration if device supports it (phones / Android) safely
  safeVibrate([500, 200, 500, 200, 500, 200, 800])
}

/**
 * Stop looping the booking alert sound immediately when dismissed or accepted.
 */
export function stopBookingAlertSound() {
  isPlaying = false
  if (audioElement) {
    try {
      audioElement.pause()
      audioElement.currentTime = 0
    } catch (err) {
      console.warn('[BookingSound] Stop audio warning:', err)
    }
  }
  safeVibrate(0)
}

// Aliases for convenience across components
export const playAlertSound = playBookingAlertSound
export const stopAlertSound = stopBookingAlertSound

export function isBookingAlertPlaying() {
  return isPlaying
}
