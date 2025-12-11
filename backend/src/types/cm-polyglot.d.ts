/**
 * Type declarations for cm-polyglot package
 * @see https://github.com/shaack/cm-polyglot
 */

declare module 'cm-polyglot' {
  export interface PolyglotMove {
    uci: string;
    move?: string;
    weight?: number;
  }

  export class Polyglot {
    constructor(bookPath: string);
    getMovesFromFen(fen: string): Promise<PolyglotMove[]>;
  }
}
