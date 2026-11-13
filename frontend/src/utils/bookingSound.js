import alertSoundSrc from '../assets/alert.mp3'

let audioElement = null
let audioContext = null
let isPlaying = false
let isUnlocked = false
let decodedAlertBuffer = null
let isBufferLoading = false
let activeBufferSource = null
let activeGainNode = null
let chimeInterval = null
let keepAliveSource = null

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
 * Preload and decode /alert.mp3 into an in-memory AudioBuffer.
 * AudioBuffers play instantly and are immune to HTMLMediaElement background throttling.
 */
async function loadAndDecodeAlertBuffer(ctx) {
  if (decodedAlertBuffer || isBufferLoading) return decodedAlertBuffer
  isBufferLoading = true
  try {
    const urls = ['/alert.mp3', alertSoundSrc]
    for (const url of urls) {
      try {
        const response = await fetch(url)
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer()
          decodedAlertBuffer = await ctx.decodeAudioData(arrayBuffer)
          console.log('[BookingSound] Preloaded & decoded alert.mp3 buffer successfully')
          break
        }
      } catch {
        // Try fallback
      }
    }
  } catch (err) {
    console.warn('[BookingSound] Buffer decode warning:', err)
  } finally {
    isBufferLoading = false
  }
  return decodedAlertBuffer
}

/**
 * Keeps Web Audio pipeline warm so browsers (Chrome, Edge, Safari) do not suspend
 * the AudioContext while the tab is hidden or in the background.
 */
function ensureAudioContextKeepAlive(ctx) {
  if (keepAliveSource || !ctx || ctx.state === 'closed') return
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    // Very near zero - completely inaudible keepalive
    gain.gain.setValueAtTime(0.000001, ctx.currentTime)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    keepAliveSource = osc
  } catch (err) {
    console.warn('[BookingSound] Keep-alive setup warning:', err)
  }
}

/**
 * Initializes and unlocks AudioContext and HTML5 Audio element on first user interaction.
 * Required by modern browser autoplay policies so sound can play when bookings arrive (in and out of app).
 */
export function unlockAudioContext() {
  try {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext
    if (AudioCtxClass && (!audioContext || audioContext.state === 'closed')) {
      audioContext = new AudioCtxClass()
    }
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {})
    }

    if (audioContext) {
      ensureAudioContextKeepAlive(audioContext)
      loadAndDecodeAlertBuffer(audioContext).catch(() => {})
    }

    if (!audioElement) {
      audioElement = new Audio('/alert.mp3')
      audioElement.preload = 'auto'
      audioElement.volume = 1.0
    }

    isUnlocked = true
  } catch (err) {
    console.warn('[BookingSound] Unlock attempt warning:', err)
  }
}

// Auto-register one-time unlock listeners on user interaction
if (typeof window !== 'undefined') {
  const handleFirstInteraction = () => {
    unlockAudioContext()
  }
  window.addEventListener('click', handleFirstInteraction, { capture: true, passive: true })
  window.addEventListener('touchstart', handleFirstInteraction, { capture: true, passive: true })
  window.addEventListener('pointerdown', handleFirstInteraction, { capture: true, passive: true })
  window.addEventListener('keydown', handleFirstInteraction, { capture: true, passive: true })

  // Re-sync playback if user switches back to tab while booking offer is active
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && isPlaying) {
        playBookingAlertSound()
      }
    })
    window.addEventListener('focus', () => {
      if (isPlaying) {
        playBookingAlertSound()
      }
    })
  }
}

/**
 * Play synthesizer backup chime using Web Audio API
 */
export function playWebAudioChime() {
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

  // 1. Resume AudioContext if suspended
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {})
  }

  // 2. Play Web Audio BufferSource (if decoded)
  if (audioContext && audioContext.state !== 'closed') {
    try {
      if (activeBufferSource) {
        try { activeBufferSource.stop() } catch {}
        activeBufferSource = null
      }

      if (decodedAlertBuffer) {
        const source = audioContext.createBufferSource()
        source.buffer = decodedAlertBuffer
        source.loop = true

        const gainNode = audioContext.createGain()
        gainNode.gain.setValueAtTime(1.0, audioContext.currentTime)

        source.connect(gainNode)
        gainNode.connect(audioContext.destination)
        source.start(0)

        activeBufferSource = source
        activeGainNode = gainNode
      } else {
        // If buffer not decoded yet, load it now and play
        loadAndDecodeAlertBuffer(audioContext).then((buf) => {
          if (buf && isPlaying && !activeBufferSource) {
            const source = audioContext.createBufferSource()
            source.buffer = buf
            source.loop = true
            const gain = audioContext.createGain()
            gain.gain.setValueAtTime(1.0, audioContext.currentTime)
            source.connect(gain)
            gain.connect(audioContext.destination)
            source.start(0)
            activeBufferSource = source
            activeGainNode = gain
          }
        }).catch(() => {})
      }
    } catch (err) {
      console.warn('[BookingSound] WebAudio buffer play warning:', err)
    }
  }

  // 3. Play HTML5 Audio element in parallel as backup
  try {
    if (!audioElement) {
      audioElement = new Audio('/alert.mp3')
      audioElement.preload = 'auto'
      audioElement.volume = 1.0
    }
    audioElement.loop = true
    audioElement.currentTime = 0
    const playPromise = audioElement.play()
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('[BookingSound] HTML5 Audio play prevented:', err?.message || err)
      })
    }
  } catch (err) {
    console.warn('[BookingSound] HTML5 Audio error:', err)
  }

  // 4. Play synthesizer chime immediately and on loop as acoustic reinforcement
  playWebAudioChime()
  if (!chimeInterval) {
    chimeInterval = setInterval(() => {
      if (isPlaying) {
        playWebAudioChime()
      } else {
        clearInterval(chimeInterval)
        chimeInterval = null
      }
    }, 2000)
  }

  // 5. Trigger vibration if device supports it (phones / Android) safely
  safeVibrate([500, 200, 500, 200, 500, 200, 800])
}

/**
 * Stop looping the booking alert sound immediately when dismissed or accepted.
 */
export function stopBookingAlertSound() {
  isPlaying = false

  if (activeBufferSource) {
    try {
      activeBufferSource.stop()
      activeBufferSource.disconnect()
    } catch {}
    activeBufferSource = null
  }

  if (activeGainNode) {
    try { activeGainNode.disconnect() } catch {}
    activeGainNode = null
  }

  if (audioElement) {
    try {
      audioElement.pause()
      audioElement.currentTime = 0
    } catch {}
  }

  if (chimeInterval) {
    clearInterval(chimeInterval)
    chimeInterval = null
  }

  safeVibrate(0)
}

// Aliases for convenience across components
export const playAlertSound = playBookingAlertSound
export const stopAlertSound = stopBookingAlertSound

export function isBookingAlertPlaying() {
  return isPlaying
}
