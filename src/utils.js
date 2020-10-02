/**
 * A promise that resolves after `ms` milliseconds
 */
const sleep = (ms) => new Promise((res) => setTimeout(res, ms))

/**
 * A promise that resolves when the source emits specified event
 */
const when = (source, event) =>
  new Promise((resolve, reject) => source.once(event, resolve).on('error', reject))

module.exports = {
  sleep,
  when,
}
