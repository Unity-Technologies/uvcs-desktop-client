export class CmError extends Error {
  constructor(
    message: string,
    readonly commandLine: string,
    readonly exitCode: number,
  ) {
    super(message);
    this.name = 'CmError';
  }
}
