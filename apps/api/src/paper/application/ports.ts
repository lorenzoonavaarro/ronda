export interface PaperGrants {
  sync(userId: string): Promise<void>;
}

export const PAPER_GRANTS = Symbol('PAPER_GRANTS');
