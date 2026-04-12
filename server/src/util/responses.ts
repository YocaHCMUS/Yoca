export const messageText = {
  AccountAlreadyExists: "Account already exists",
  InvalidEmailOrPassword: "Email or password was incorrect",
  CouldNotVerifyGoogleAccount: "Could not verify Google account",
  UserCreatedSuccessfully: "User created successfully",
  LoggedInSuccessfully: "Logged-in successfully",
  GoogleLoggedInSuccessfully: "Google logged-in successfully",
  LoggedOutSuccessfully: "Logged out successfully",
  LoginNounceGeneratedSuccessfully: "Login nounce generated successfully",
  WalletVerificationFailed: "Wallet verification failed",
  WalletVerifiedSuccessfully: "Wallet verified successfully",
  InternalServerError: "Internal server error",
  FailedToFetchRequestData: "Fail to fetch data",
} as const;

export const statusCode = {
  Ok: 200,
  Created: 201,
  Accepted: 202,
  BadRequest: 400,
  Unauthorized: 401,
  NotFound: 404,
  InternalServerError: 500,
  BadGateway: 502,
  UnprocessableEntity: 422,
} as const;
