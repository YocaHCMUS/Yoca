export const ErrCodes = {
  internalServerErr: "INTERNAL_SERVER_ERR",
  failedToFetchRequestedData: "FAILED_TO_FETCH_REQUESTED_DATA",
  emailAlreadyExisted: "EMAIL_ALREADY_EXISTED",
  emailOrPasswordWasIncorrect: "EMAIL_OR_PASSWORD_WAS_INCORRECT",
  walletVerificationFailed: "WALLET_VERIFICATION_FAILED",
  walletNonceFailed: "WALLET_NONCE_FAILED",
  googleVerificationFailed: "GOOGLE_VERIFICATION_FAILED",
  generalUnknownErr: "GENERAL_UNKNOWN_ERR",
  networkErr: "NETWORK_ERR",
  validationErr: "VALIDATION_ERR",
  invalidTokenPayload: "INVALID_TOKEN_PAYLOAD",
  hourlyChartHourlyExceeded90Days: "HOURLY_CHART_HOURLY_EXCEEDED_90_DAYS",
  dailyChartDailyExceeded365Days: "DAILY_CHART_DAILY_EXCEEDED_365_DAYS",
} as const;

export type ErrCode = (typeof ErrCodes)[keyof typeof ErrCodes];

export function setErr<T extends ErrCode>(code: T) {
  return { errorCode: code };
}
