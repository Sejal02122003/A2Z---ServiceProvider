import { normalizeIndianPhone } from '../utils/phone.js'

/**
 * Production DLT configuration for Bringshine A2Z Service Hub
 */
const DEFAULT_CONFIG = {
  dltEntityId: '1705176734391048562',
  dltTemplateId: '1707176735046894644',
  header: 'BRSATZ',
  templateName: 'OTPs',
  templateText:
    'Your Verification Code for sign up in Bringshine A2Z Service Hub is \n{#var#}\n Valid for limited time only. Bringshine A2Z Service Hub',
}

/**
 * Build the exact DLT-approved SMS message replacing {#var#} with the generated OTP
 */
export function buildOtpSmsMessage(otp) {
  const template = process.env.SMS_TEMPLATE || DEFAULT_CONFIG.templateText
  return template.replace(/\{#var#\}/g, String(otp))
}

/**
 * Get current SMS / DLT runtime configuration from environment or defaults
 */
export function getSmsConfig() {
  return {
    enabled: process.env.SMS_ENABLED !== 'false',
    dltEntityId: process.env.DLT_HEADER_ID || process.env.DLT_ENTITY_ID || DEFAULT_CONFIG.dltEntityId,
    dltTemplateId: process.env.DLT_ID || process.env.DLT_TEMPLATE_ID || DEFAULT_CONFIG.dltTemplateId,
    header: process.env.SMS_HEADER || process.env.SMS_SENDER_ID || DEFAULT_CONFIG.header,
    gatewayUrl: process.env.SMS_GATEWAY_URL || '',
    apiKey: process.env.SMS_API_KEY || process.env.SMS_AUTH_KEY || '',
    provider: (process.env.SMS_PROVIDER || 'generic').toLowerCase(),
  }
}

/**
 * Send OTP via DLT-approved SMS Gateway
 * Supports Fast2SMS, MSG91, Textlocal, and custom HTTP SMS gateways.
 * Safe and non-blocking: never crashes the OTP generation flow if telecom API is unreachable.
 */
export async function sendOtpSms({ phone, otp, purpose = 'auth' }) {
  const config = getSmsConfig()
  const rawDigits = String(phone || '').replace(/\D/g, '')
  const normalizedPhone = normalizeIndianPhone(phone) || rawDigits.slice(-10)

  if (!normalizedPhone || normalizedPhone.length !== 10) {
    console.warn(`[SMS] Invalid Indian phone number provided: ${phone}`)
    return { success: false, reason: 'INVALID_PHONE' }
  }

  const message = buildOtpSmsMessage(otp)

  if (!config.enabled) {
    console.info(`[SMS] SMS sending disabled (SMS_ENABLED=false). OTP: ${otp} for ${normalizedPhone}`)
    return { success: true, bypassed: true, mode: 'DISABLED' }
  }

  // If no gateway URL or API key is configured yet, log formatted DLT dispatch for inspection
  if (!config.gatewayUrl && !config.apiKey) {
    console.info(
      `[SMS DLT Ready] Header: ${config.header} | DLT Template ID: ${config.dltTemplateId} | Entity: ${config.dltEntityId}\n` +
      `  To: +91${normalizedPhone}\n` +
      `  Message: "${message.replace(/\n/g, ' ')}"\n` +
      `  Status: Set SMS_GATEWAY_URL / SMS_API_KEY in .env to dispatch live SMS packets.`
    )
    return { success: true, queued: true, provider: 'mock' }
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    let response
    const provider = config.provider

    if (provider === 'fast2sms') {
      // Fast2SMS DLT endpoint
      const url = 'https://www.fast2sms.com/dev/bulkV2'
      response = await fetch(url, {
        method: 'POST',
        headers: {
          authorization: config.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: 'dlt',
          sender_id: config.header,
          message: config.dltTemplateId,
          variables_values: String(otp),
          flash: 0,
          numbers: normalizedPhone,
        }),
        signal: controller.signal,
      })
    } else if (provider === 'msg91') {
      // MSG91 OTP endpoint
      const url = `https://api.msg91.com/api/v5/otp?template_id=${config.dltTemplateId}&mobile=91${normalizedPhone}&authkey=${config.apiKey}&otp=${otp}`
      response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })
    } else if (config.gatewayUrl) {
      // Generic HTTP Gateway: replaces standard DLT parameter placeholders
      let targetUrl = config.gatewayUrl
        .replace(/\{PHONE\}/g, encodeURIComponent(normalizedPhone))
        .replace(/\{FULL_PHONE\}/g, encodeURIComponent('91' + normalizedPhone))
        .replace(/\{OTP\}/g, encodeURIComponent(otp))
        .replace(/\{MESSAGE\}/g, encodeURIComponent(message))
        .replace(/\{HEADER\}/g, encodeURIComponent(config.header))
        .replace(/\{TEMPLATE_ID\}/g, encodeURIComponent(config.dltTemplateId))
        .replace(/\{ENTITY_ID\}/g, encodeURIComponent(config.dltEntityId))
        .replace(/\{API_KEY\}/g, encodeURIComponent(config.apiKey))

      const hasMethod = (process.env.SMS_HTTP_METHOD || 'GET').toUpperCase()
      if (hasMethod === 'POST') {
        response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(config.apiKey ? { Authorization: config.apiKey } : {}),
          },
          body: JSON.stringify({
            mobile: normalizedPhone,
            phone: normalizedPhone,
            otp: String(otp),
            message,
            sender: config.header,
            entityId: config.dltEntityId,
            templateId: config.dltTemplateId,
          }),
          signal: controller.signal,
        })
      } else {
        response = await fetch(targetUrl, {
          method: 'GET',
          signal: controller.signal,
        })
      }
    }

    clearTimeout(timeoutId)

    if (response) {
      const respText = await response.text().catch(() => '')
      if (response.ok) {
        console.info(`[SMS] Successfully dispatched OTP to +91${normalizedPhone} via ${provider}. Status: ${response.status}`)
        return { success: true, response: respText }
      }
      console.warn(`[SMS] Gateway responded with HTTP ${response.status}: ${respText}`)
      return { success: false, status: response.status, response: respText }
    }

    return { success: false, reason: 'NO_RESPONSE' }
  } catch (err) {
    console.error(`[SMS_ERROR] Failed to send SMS to +91${normalizedPhone}:`, err.message)
    return { success: false, error: err.message }
  }
}
