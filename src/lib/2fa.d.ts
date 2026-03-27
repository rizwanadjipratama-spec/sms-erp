declare module 'qrcode' {
  export function toDataURL(input: string, options?: Record<string, unknown>): Promise<string>;
}
