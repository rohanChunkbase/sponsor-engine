export class RecapInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecapInputError";
  }
}
