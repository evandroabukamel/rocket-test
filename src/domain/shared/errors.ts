/** Base de todo erro de regra de negócio. Erros de domínio nunca são erros de programação. */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
