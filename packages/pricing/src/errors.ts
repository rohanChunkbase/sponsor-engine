/** A booking file or a quote request is not valid. */
export class BookingDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BookingDataError';
  }
}
