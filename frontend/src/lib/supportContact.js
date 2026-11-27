// Used until the admin-configured values load (or if the request fails).
export const DEFAULT_SUPPORT_CONTACT = {
  supportPhone: '+917610125193',
  emergencyPhone: '+917610125193',
  whatsappNumber: '+917610125193',
  supportEmail: 'rahulbairwa7610@gmail.com',
}

export function whatsAppSupportUrl(number, message = 'Hi A2Z, I need help with my service booking.') {
  const digits = String(number || '').replace(/\D/g, '').replace(/^0+/, '')
  // A bare 10-digit number is Indian; anything longer already carries its country code
  const phone = digits.length === 10 ? `91${digits}` : digits
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}
