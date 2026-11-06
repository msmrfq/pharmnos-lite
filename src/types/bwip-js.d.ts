declare module "bwip-js" {
  export function toBuffer(options: {
    bcid: string;
    text: string;
    scale?: number;
    height?: number;
    includetext?: boolean;
  }): Promise<Buffer>;
}
