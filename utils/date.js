function pad(value) {
  return String(value).padStart(2, '0')
}

function formatDate(date) {
  const target = date instanceof Date ? date : new Date(date)
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`
}

function daysBetween(from, to) {
  const start = new Date(formatDate(from)).getTime()
  const end = new Date(formatDate(to)).getTime()
  return Math.ceil((end - start) / 86400000)
}

function displayDate(value) {
  if (!value) return '待定'
  const date = new Date(value)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

module.exports = {
  formatDate,
  daysBetween,
  displayDate
}
