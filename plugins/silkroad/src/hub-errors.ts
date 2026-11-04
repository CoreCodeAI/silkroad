/** An error whose message is meant for the user, with the HTTP status the panel API should use. */
export class UserError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}
