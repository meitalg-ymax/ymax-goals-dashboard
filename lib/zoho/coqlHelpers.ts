// COQL quirk (confirmed through trial and error): 3+ chained AND conditions
// need explicit nested parentheses -- a flat "A and B and C" throws
// SYNTAX_ERROR. Folding left-to-right with parens at every step works for
// any number of conditions (2 is harmless to over-parenthesize too).
export function andAll(conditions: string[]): string {
  if (conditions.length === 0) throw new Error("andAll requires at least one condition");
  return conditions.reduce((acc, cond) => `(${acc} and ${cond})`);
}

export function orAll(conditions: string[]): string {
  if (conditions.length === 0) throw new Error("orAll requires at least one condition");
  return conditions.reduce((acc, cond) => `(${acc} or ${cond})`);
}

// Escapes a value for a COQL string literal (single-quoted).
export function coqlStr(value: string): string {
  return value.replace(/'/g, "\\'");
}
