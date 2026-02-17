export const messageText = {
  FailedToFetchRequestedData:
    "Failed to fetch requested data. Please try again later",
  FailedToFetchExternalData: "Failed to fetch data from external sources",
  InternalServerError:
    "There was a problem happened on the server. Please try again later.",
  AccountAlreadyExists: "Account already exists",
  EmailOrUsernameAlreadyExists: "Email or username already exists",
  InvalidEmailOrPassword: "Email or password was incorrect",
  CouldNotVerifyGoogleAccount: "Could not verify Google account",
  UserCreatedSuccessfully: "User created successfully",
  LoggedInSuccessfully: "Logged-in successfully",
  GoogleLoggedInSuccessfully: "Google logged-in successfully",
  LoggedOutSuccessfully: "Logged out successfully",
  SolanaNounceGeneratedSuccessfully:
    "Solana login nounce generated successfully",
  SolanaWalletVerificationFailed: "Solana wallet verification failed",
  SolanaWalletVerifiedSuccessfully: "Solana wallet verified successfully",
} as const;

export const statusCode = {
  Ok: 200,
  Created: 201,
  Accepted: 202,
  BadRequest: 400,
  Unauthorized: 401,
  InternalServerError: 500,
  BadGateway: 502,
} as const;
