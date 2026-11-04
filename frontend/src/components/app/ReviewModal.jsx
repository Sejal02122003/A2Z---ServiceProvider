import { BookingReviewModal } from './booking/BookingReviewModal.jsx'

export function ReviewModal({ open, bookingId, workerName, onClose, onSubmitted }) {
  return (
    <BookingReviewModal
      open={open}
      bookingId={bookingId}
      workerName={workerName}
      onClose={onClose}
      onSubmitted={onSubmitted || onClose}
    />
  )
}
