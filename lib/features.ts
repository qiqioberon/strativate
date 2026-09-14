export const featureFlags = {
  digitalProducts: false,
} as const

export function isDigitalProductsEnabled(value = process.env.FEATURE_DIGITAL_PRODUCTS) {
  return value === 'true'
}
