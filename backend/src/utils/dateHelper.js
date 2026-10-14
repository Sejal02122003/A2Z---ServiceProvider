export function parseISTDateTime(dateString, timeSlot) {
  if (!dateString) return new Date();
  
  const rawStr = dateString instanceof Date ? dateString.toISOString() : String(dateString)
  let datePart = rawStr.split('T')[0]
  
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const d = new Date(datePart)
    if (!isNaN(d.getTime())) {
      const pad = (n) => n.toString().padStart(2, '0')
      datePart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    } else {
      return new Date() // Fallback
    }
  }

  let slotStr = timeSlot ? String(timeSlot).trim() : ''

  // If timeSlot is a named period, convert to standard hours
  const upperSlot = slotStr.toUpperCase()
  if (upperSlot === 'MORNING') {
    slotStr = '09:00 AM'
  } else if (upperSlot === 'AFTERNOON') {
    slotStr = '01:00 PM'
  } else if (upperSlot === 'EVENING') {
    slotStr = '05:00 PM'
  }
  
  if (!slotStr) {
    // If dateString had a time component (like an ISO string with T), extract it
    if (rawStr.includes('T')) {
      const timePart = rawStr.split('T')[1]?.replace('Z', '')?.split('.')[0]
      if (timePart) {
        const [isoH, isoM] = timePart.split(':')
        if (isoH !== undefined && isoM !== undefined) {
          // If already in UTC, create date directly
          const directDate = new Date(rawStr)
          if (!isNaN(directDate.getTime())) {
            return directDate
          }
        }
      }
    }
    return new Date(datePart) // Fallback to midnight UTC if no time
  }

  // Try to parse 12-hour AM/PM format (e.g. "10:00 AM", "10:00 AM – 1:00 PM", "10:00 AM - 1:00 PM")
  const timeMatch12 = slotStr.match(/(\d+):(\d+)\s*(AM|PM)/i)
  let h, m;

  if (timeMatch12) {
    const [ , hStr, mStr, ampm ] = timeMatch12
    h = parseInt(hStr, 10)
    m = parseInt(mStr, 10)
    if (ampm.toUpperCase() === 'PM' && h < 12) h += 12
    if (ampm.toUpperCase() === 'AM' && h === 12) h = 0
  } else {
    // Try to parse 24-hour format (e.g. "18:35", "09:00")
    const timeMatch24 = slotStr.match(/(\d+):(\d+)/)
    if (timeMatch24) {
      h = parseInt(timeMatch24[1], 10)
      m = parseInt(timeMatch24[2], 10)
    } else {
      return new Date(datePart) // Fallback
    }
  }

  const pad = (n) => n.toString().padStart(2, '0')
  
  // Create an ISO string with exact IST timezone offset (+05:30)
  const isoString = `${datePart}T${pad(h)}:${pad(m)}:00.000+05:30`
  const resultDate = new Date(isoString)
  console.log(`[dateHelper] parseISTDateTime("${dateString}", "${timeSlot}") -> ${resultDate.toISOString()} (IST: ${pad(h)}:${pad(m)})`)
  
  return resultDate
}

