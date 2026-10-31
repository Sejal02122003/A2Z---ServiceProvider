import dotenv from 'dotenv'
import dns from 'node:dns'

dotenv.config({ override: true })

if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first')
}

try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4'])
} catch {
  // Ignore if custom DNS servers cannot be set
}
