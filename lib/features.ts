export function isDigitalProductsEnabled(value = process.env.FEATURE_DIGITAL_PRODUCTS) {
  return value === 'true'
}
