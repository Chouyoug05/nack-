declare module '@zxing/browser' {
  export interface IScannerControls {
    stop: () => void;
  }
  export class BrowserMultiFormatReader {
    decodeFromVideoDevice(
      deviceId: string | undefined,
      videoElement: HTMLVideoElement,
      callback: (result: { getText(): string } | null, error: any | null) => void
    ): Promise<IScannerControls>;
    reset(): void;
  }
} 