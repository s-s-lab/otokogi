declare global {
  interface Window {
    OTOKOGI_CONFIG?: {
      apiUrl?: string
    }
  }
}

export const API_URL = window.OTOKOGI_CONFIG?.apiUrl?.trim() ?? ''

export const isApiConfigured = /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(
  API_URL,
)
