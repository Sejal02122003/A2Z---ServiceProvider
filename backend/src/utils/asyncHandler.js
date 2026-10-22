/**
 * Wrap async route handlers — avoids try/catch in every controller.
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    return Promise.resolve(fn(req, res, next)).catch((err) => {
      if (typeof next === 'function') {
        next(err)
      } else {
        throw err
      }
    })
  }
}
