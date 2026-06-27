declare module "quantize" {
  interface CMap {
    palette(): number[][];
    size(): number;
    map(color: number[]): number[];
    push(vbox: unknown): void;
    vboxes: unknown;
  }
  function quantize(
    pixels: number[][],
    maxColors: number
  ): CMap | false;
  export = quantize;
}
