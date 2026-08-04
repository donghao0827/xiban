function integer(value) {
  const digits = String(value === undefined || value === null ? '' : value).replace(/\D/g, '')
  return digits.replace(/^0+(?=\d)/, '')
}

function money(value) {
  const cleaned = String(value === undefined || value === null ? '' : value).replace(/[^\d.]/g, '')
  const dotIndex = cleaned.indexOf('.')
  if (dotIndex < 0) return integer(cleaned)
  const whole = integer(cleaned.slice(0, dotIndex)) || '0'
  const decimal = cleaned.slice(dotIndex + 1).replace(/\D/g, '').slice(0, 2)
  return `${whole}.${decimal}`
}

module.exports = { integer, money }
