/**
 * Sliding window rate limiter to throttle suspicious submissions, repeated registration
 * attempts, and OTP requests.
 */
class SlidingWindowRateLimiter {
  constructor(windowMs = 60000, maxRequests = 10) {
    this.windowMs = windowMs
    this.maxRequests = maxRequests
    this.requests = new Map()

    // Periodic cleanup every 5 minutes to avoid memory leaks
    setInterval(() => this.cleanup(), 5 * 60 * 1000).unref()
  }

  isAllowed(key) {
    const now = Date.now()
    const timestamps = this.requests.get(key) || []
    const cutoff = now - this.windowMs

    const validTimestamps = timestamps.filter((t) => t > cutoff)

    if (validTimestamps.length >= this.maxRequests) {
      this.requests.set(key, validTimestamps)
      const oldest = validTimestamps[0]
      const retryAfterMs = oldest + this.windowMs - now
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      }
    }

    validTimestamps.push(now)
    this.requests.set(key, validTimestamps)
    return { allowed: true }
  }

  cleanup() {
    const now = Date.now()
    const cutoff = now - this.windowMs
    for (const [key, timestamps] of this.requests.entries()) {
      const valid = timestamps.filter((t) => t > cutoff)
      if (valid.length === 0) {
        this.requests.delete(key)
      } else {
        this.requests.set(key, valid)
      }
    }
  }
}

// 5 OTP requests per phone per 10 minutes
export const otpRequestLimiter = new SlidingWindowRateLimiter(10 * 60 * 1000, 5)

// 10 registration attempts per IP per 5 minutes
export const registrationAttemptLimiter = new SlidingWindowRateLimiter(5 * 60 * 1000, 10)

// 5 identity verification submissions per user per 15 minutes
export const identityVerificationLimiter = new SlidingWindowRateLimiter(15 * 60 * 1000, 5)
