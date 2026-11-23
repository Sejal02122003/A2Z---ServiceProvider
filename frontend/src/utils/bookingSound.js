import alertSoundSrc from '../assets/alert.mp3'

let audioElement = null
let activePlayPromise = null
let audioContext = null
let isPlaying = false
let isUnlocked = false
let decodedAlertBuffer = null
let isBufferLoading = false
let activeBufferSource = null
let activeGainNode = null
let chimeInterval = null
let keepAliveSource = null
let isAutoplayBlocked = false
const autoplayBlockedListeners = new Set()

function notifyAutoplayBlockedChange(blocked) {
  isAutoplayBlocked = blocked
  autoplayBlockedListeners.forEach((fn) => {
    try { fn(blocked) } catch {}
  })
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('a2z-autoplay-blocked-change', { detail: { blocked } }))
  }
}

export function subscribeAutoplayBlocked(fn) {
  autoplayBlockedListeners.add(fn)
  return () => autoplayBlockedListeners.delete(fn)
}

export function getAutoplayBlockedStatus() {
  return isAutoplayBlocked
}

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

      // Play a short silent buffer to satisfy browser user-gesture unlock requirement
      try {
        const silentBuf = audioContext.createBuffer(1, 1, 22050)
        const silentSource = audioContext.createBufferSource()
        silentSource.buffer = silentBuf
        silentSource.connect(audioContext.destination)
        silentSource.start(0)
      } catch {}
    }

    if (!audioElement) {
      audioElement = new Audio('/alert.mp3')
      audioElement.preload = 'auto'
      audioElement.volume = 1.0
    }

    // Prime the audio element with a brief gesture-initiated play/pause
    if (audioElement && !isPlaying) {
      const primePromise = audioElement.play()
      if (primePromise !== undefined) {
        primePromise
          .then(() => {
            if (!isPlaying && audioElement) {
              audioElement.pause()
              audioElement.currentTime = 0
            }
          })
          .catch(() => {})
      }
    }

    isUnlocked = true
    notifyAutoplayBlockedChange(false)

    // If an alert was requested while locked, kick it off immediately now that we are unlocked
    if (isPlaying) {
      executeAudioPlayback()
    }
  } catch (err) {
    console.warn('[BookingSound] Unlock attempt warning:', err)
  }
}

// Auto-register unlock listeners on any user interaction anywhere on the page
if (typeof window !== 'undefined') {
  const handleUserInteraction = () => {
    unlockAudioContext()
    if (isPlaying) {
      executeAudioPlayback()
    }
  }
  window.addEventListener('click', handleUserInteraction, { capture: true, passive: true })
  window.addEventListener('touchstart', handleUserInteraction, { capture: true, passive: true })
  window.addEventListener('pointerdown', handleUserInteraction, { capture: true, passive: true })
  window.addEventListener('keydown', handleUserInteraction, { capture: true, passive: true })

  // Re-sync playback if user switches back to tab while booking offer is active
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && isPlaying) {
        unlockAudioContext()
        executeAudioPlayback()
      }
    })
    window.addEventListener('focus', () => {
      if (isPlaying) {
        unlockAudioContext()
        executeAudioPlayback()
      }
    })
  }

  // Listen for global sound stop event
  window.addEventListener('a2z-stop-booking-sound', () => {
    stopBookingAlertSound()
  })
}

/**
 * Play synthesizer backup chime using Web Audio API
 */
export function playWebAudioChime() {
  if (!isPlaying) return
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

let currentPlayingId = null
let lastPlayTimestamp = 0

/**
 * Internal execution of actual audio pipelines (WebAudio buffer, HTML5 audio, chime, vibration).
 */
function executeAudioPlayback() {
  if (!isPlaying) return

  const AudioCtxClass = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null
  if (AudioCtxClass && (!audioContext || audioContext.state === 'closed')) {
    audioContext = new AudioCtxClass()
  }

  // 1. Resume AudioContext if suspended
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume().then(() => {
      notifyAutoplayBlockedChange(false)
    }).catch(() => {
      notifyAutoplayBlockedChange(true)
    })
  }

  // 2. Play Web Audio BufferSource (if decoded)
  if (audioContext && audioContext.state !== 'closed') {
    try {
      if (activeBufferSource) {
        try { activeBufferSource.stop(0) } catch {}
        try { activeBufferSource.disconnect() } catch {}
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
        notifyAutoplayBlockedChange(false)
      } else {
        // If buffer not decoded yet, load it now and play
        loadAndDecodeAlertBuffer(audioContext).then((buf) => {
          if (buf && isPlaying && !activeBufferSource && audioContext && audioContext.state !== 'closed') {
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
            notifyAutoplayBlockedChange(false)
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
    activePlayPromise = audioElement.play()
    if (activePlayPromise !== undefined) {
      activePlayPromise
        .then(() => {
          notifyAutoplayBlockedChange(false)
        })
        .catch((err) => {
          if (err?.name === 'NotAllowedError') {
            console.warn('[BookingSound] Autoplay blocked by browser policy. Awaiting user tap to unblock.')
            notifyAutoplayBlockedChange(true)
          }
        })
    }
  } catch (err) {
    console.warn('[BookingSound] HTML5 Audio error:', err)
    notifyAutoplayBlockedChange(true)
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
 * Start looping the booking alert sound (in-app and background).
 * Safe against duplicate rapid calls from simultaneous socket/push/SW events.
 */
export function playBookingAlertSound(bookingOrEventId = null) {
  const nowMs = Date.now()
  if (isPlaying && bookingOrEventId && currentPlayingId === bookingOrEventId) {
    // Already playing for this specific booking event - resume context if needed and keep running
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().then(() => notifyAutoplayBlockedChange(false)).catch(() => notifyAutoplayBlockedChange(true))
    }
    return
  }

  if (isPlaying && (nowMs - lastPlayTimestamp < 1500)) {
    // Suppress rapid re-triggering within 1.5s to avoid audio glitching/doubling
    return
  }

  isPlaying = true
  currentPlayingId = bookingOrEventId || currentPlayingId
  lastPlayTimestamp = nowMs

  executeAudioPlayback()
}

let lastSwStopNotify = 0

/**
 * Stop looping the booking alert sound immediately when dismissed, accepted, or rejected.
 * Completely shuts down Web Audio, HTML5 Audio, Chime intervals, Vibrations, and SW notifications.
 */
export function stopBookingAlertSound(notifySw = true) {
  const wasPlaying = isPlaying || Boolean(activeBufferSource || chimeInterval || audioElement)
  isPlaying = false
  currentPlayingId = null

  // 1. Disconnect and stop Web Audio buffer source
  if (activeBufferSource) {
    try {
      activeBufferSource.stop(0)
      activeBufferSource.disconnect()
    } catch {}
    activeBufferSource = null
  }

  // 2. Mute and disconnect gain node immediately
  if (activeGainNode) {
    try {
      if (audioContext && audioContext.currentTime) {
        activeGainNode.gain.setValueAtTime(0, audioContext.currentTime)
      }
      activeGainNode.disconnect()
    } catch {}
    activeGainNode = null
  }

  // 3. Clear synthesizer chime interval
  if (chimeInterval) {
    clearInterval(chimeInterval)
    chimeInterval = null
  }

  // 4. Force HTML5 audio to pause and cancel loop
  if (audioElement) {
    try {
      audioElement.pause()
      audioElement.currentTime = 0
      audioElement.loop = false
    } catch {}
    if (activePlayPromise) {
      activePlayPromise
        .then(() => {
          if (!isPlaying && audioElement) {
            audioElement.pause()
            audioElement.currentTime = 0
          }
        })
        .catch(() => {})
      activePlayPromise = null
    }
  }

  // 5. Stop vibrations
  safeVibrate(0)

  // 6. Notify Service Worker to stop alert sound and dismiss notification across all clients
  // Only notify SW if notifySw is true AND the sound was actually active, debounced to max once every 1s
  const now = Date.now()
  if (notifySw && wasPlaying && (now - lastSwStopNotify > 1000) && typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
    lastSwStopNotify = now
    try {
      navigator.serviceWorker.controller.postMessage({
        type: 'STOP_BOOKING_ALERT_SOUND',
      })
    } catch {}
  }

  // 7. Close all active browser notifications for bookings
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.getRegistrations) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((reg) => {
        reg.getNotifications?.().then((notifs) => {
          notifs.forEach((n) => {
            if (n.tag?.startsWith('booking-') || n.tag === 'new_booking_alerts_v2') {
              n.close()
            }
          })
        }).catch(() => {})
      })
    }).catch(() => {})
  }

  // 8. Notify Flutter native wrapper if running in app
  if (typeof window !== 'undefined' && window.flutter_inappwebview?.callHandler) {
    try {
      window.flutter_inappwebview.callHandler('stopBookingAlertSound').catch(() => {})
    } catch {}
  }
}

// Aliases for convenience across components
export const playAlertSound = playBookingAlertSound
export const stopAlertSound = stopBookingAlertSound

export function isBookingAlertPlaying() {
  return isPlaying
}
