// domain/format: how the site writes scores, dates, times and time controls.
// Pure code shared by the site (`@domain/format`), the server functions and
// the workers (relative imports). No database, DOM, Workers types or React.

export { formatScore } from './score'
export { formatDate, type DateInput, type FormatDateOptions, type StoredAs } from './date'
export { formatTime, type FormatTimeOptions } from './clock'
export { formatTimeControl, describeTimeControl } from './timeControl'
