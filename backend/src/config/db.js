import mongoose from 'mongoose'
import dns from 'node:dns'

// Force Node.js on Windows to prioritize IPv4 over IPv6 for MongoDB Atlas DNS SRV resolution
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first')
}

export async function connectDb(maxRetries = 5, retryDelayMs = 3000) {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI is not set')
  }

  mongoose.set('strictQuery', true)

  const options = {
    serverSelectionTimeoutMS: 15000, // 15 seconds to select a replica set server
    connectTimeoutMS: 20000,         // 20 seconds connection timeout
    socketTimeoutMS: 45000,          // 45 seconds socket inactivity timeout
    maxIdleTimeMS: 60000,            // Close idle sockets after 60s
    maxPoolSize: 25,
    minPoolSize: 5,
    retryWrites: true,
    family: 4,                       // Force IPv4 to prevent Windows getaddrinfo ENOTFOUND
  }

  // Setup connection lifecycle handlers once
  if (!mongoose.connection._hasLifecycleHandlers) {
    mongoose.connection._hasLifecycleHandlers = true
    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB] Connection lost. Reconnecting...')
    })
    mongoose.connection.on('reconnected', () => {
      console.log('[MongoDB] Successfully reconnected to cluster.')
    })
    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB] Connection error:', err.message)
    })
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[MongoDB] Connecting to database (attempt ${attempt}/${maxRetries})...`)
      await mongoose.connect(uri, options)
      console.log('[MongoDB] Connected successfully.')
      return mongoose.connection
    } catch (err) {
      console.error(`[MongoDB] Connection attempt ${attempt} failed: ${err.message}`)
      if (attempt === maxRetries) {
        throw err
      }
      console.log(`[MongoDB] Retrying in ${retryDelayMs / 1000}s...`)
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
    }
  }

  return mongoose.connection
}

