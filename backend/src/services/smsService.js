import { normalizeIndianPhone } from '../utils/phone.js'

/**
 * Production DLT configuration for Bringshine A2Z Service Hub
 */
const DEFAULT_CONFIG = {
  dltEntityId: '1701176673394787391',
  dltHeaderId: '1705176734391048562',
  dltTemplateId: '1707176735046894644',
  header: 'BRSATZ',
  templateName: 'OTPs',
  templateText:
    'Your Verification Code for sign up in Bringshine A2Z Service Hub is {#var#} Valid for limited time only. Bringshine A2Z Service Hub',
}

/**
 * Build the exact DLT-approved SMS message replacing {#var#} with the generated OTP
 */
export function buildOtpSmsMessage(otp) {
  let template = process.env.SMS_TEMPLATE || DEFAULT_CONFIG.templateText
  // Telecom DLT strictly requires exact spacing without extra newlines
  template = template
    .replace(/\\r\\n/g, ' ')
    .replace(/\\n/g, ' ')
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return template.replace(/\{#var#\}/g, String(otp))
}

/**
 * Get current SMS / DLT runtime configuration from environment or defaults
 */
export function getSmsConfig() {
  return {
    enabled: process.env.SMS_ENABLED !== 'false',
    dltEntityId: process.env.DLT_PE_ID || process.env.DLT_ENTITY_ID || DEFAULT_CONFIG.dltEntityId,
    dltHeaderId: process.env.DLT_HEADER_ID || DEFAULT_CONFIG.dltHeaderId,
    dltTemplateId: process.env.DLT_ID || process.env.DLT_TEMPLATE_ID || DEFAULT_CONFIG.dltTemplateId,
    header: process.env.SMS_HEADER || process.env.SMS_SENDER_ID || DEFAULT_CONFIG.header,
    gatewayUrl: process.env.SMS_GATEWAY_URL || 'http://wsms.pansoftech.com/api/pushsms.php',
    username: process.env.SMS_USERNAME || 'BRINGSHINE',
    password: process.env.SMS_PASSWORD || '',
    apiKey: process.env.SMS_API_KEY || process.env.SMS_AUTH_KEY || '',
    provider: (process.env.SMS_PROVIDER || 'pansoft').toLowerCase(),
  }
}

/**
 * Send OTP via DLT-approved SMS Gateway
 * Supports PanSoft, Fast2SMS, MSG91, Textlocal, and custom HTTP SMS gateways.
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

  // If no gateway URL or credentials configured, log formatted DLT dispatch for inspection
  if (!config.gatewayUrl && !config.apiKey && !config.password) {
    console.info(
      `[SMS DLT Ready] Header: ${config.header} | DLT Template ID: ${config.dltTemplateId} | Entity: ${config.dltEntityId}\n` +
      `  To: +91${normalizedPhone}\n` +
      `  Message: "${message}"\n` +
      `  Status: Set SMS credentials in .env to dispatch live SMS packets.`
    )
    return { success: true, queued: true, provider: 'mock' }
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    let response
    const provider = config.provider

    if (
      provider === 'pansoft' ||
      config.gatewayUrl.includes('pansoftech.com') ||
      config.gatewayUrl.includes('pushsms.php')
    ) {
      // PanSoft Technologies DLT pushsms endpoint
      const targetUrl = config.gatewayUrl || 'http://wsms.pansoftech.com/api/pushsms.php'
      const params = new URLSearchParams()
      params.append('username', config.username)
      params.append('password', config.password)
      params.append('sender', config.header)
      params.append('message', message)
      params.append('numbers', normalizedPhone)
      params.append('unicode', 'false')
      params.append('flash', 'false')
      // Essential DLT IDs for operator telecom routing
      params.append('dlt_template_id', config.dltTemplateId)
      params.append('template_id', config.dltTemplateId)
      if (config.dltHeaderId) {
        params.append('dlt_header_id', config.dltHeaderId)
      }
      if (config.dltEntityId) {
        params.append('pe_id', config.dltEntityId)
      }

      try {
        response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
          signal: controller.signal,
        })
      } catch (fetchErr) {
        // If domain DNS lookup fails (e.g. ENOTFOUND wsms.pansoftech.com), fallback directly to PanSoft's IP
        if (targetUrl.includes('wsms.pansoftech.com')) {
          console.warn(`[SMS] DNS lookup failed for wsms.pansoftech.com (${fetchErr.message}). Retrying with direct IP fallback (125.17.179.82)...`)
          const fallbackUrl = 'http://125.17.179.82/api/pushsms.php'
          response = await fetch(fallbackUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Host': 'wsms.pansoftech.com',
            },
            body: params.toString(),
            signal: controller.signal,
          })
        } else {
          throw fetchErr
        }
      }
    } else if (provider === 'fast2sms') {
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
      let respJson = null
      try {
        respJson = JSON.parse(respText)
      } catch {
        // Plain text response
      }

      if (respJson && respJson.return === false) {
        console.warn(`[SMS] Gateway rejected SMS dispatch to +91${normalizedPhone}: ${respJson.message || respText}`)
        return { success: false, reason: respJson.message || 'GATEWAY_ERROR', response: respText }
      }

      if (response.ok || (respJson && respJson.return === true)) {
        const jobId = respJson?.job_id ? ` (Job ID: ${respJson.job_id})` : ''
        console.info(`[SMS] Successfully dispatched OTP to +91${normalizedPhone} via ${provider}.${jobId}`)
        return { success: true, response: respText, jobId: respJson?.job_id }
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
