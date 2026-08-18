/**
 * munkres-js ships no type declarations. It exports a single function that
 * takes a cost matrix and returns the minimum-cost pairings as [row, col].
 */
declare module "munkres-js" {
  function computeMunkres(costMatrix: number[][]): number[][];
  export = computeMunkres;
}
