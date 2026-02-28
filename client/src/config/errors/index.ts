export type AppErrCode = "NetworkErr";

export class AppErr extends Error {
  constructor(
    public code: AppErrCode,
    message?: string,
  ) {
    super(message);
    this.name = code;
  }
}
