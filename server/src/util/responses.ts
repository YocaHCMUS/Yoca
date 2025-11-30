export const messageText = {
  FailedToFetchRequestedData:
    "Failed to fetch requested data. Please try again later",
  FailedToFetchExternalData: "Failed to fetch data from external sources",
  InternalServerError:
    "There was a problem happened on the server. Please try again later.",
} as const;

export const statusCode = {
  Ok: 200,
  Created: 201,
  Accepted: 202,
  InternalServerError: 500,
  BadGateway: 502,
  BadRequest: 400,
} as const;
