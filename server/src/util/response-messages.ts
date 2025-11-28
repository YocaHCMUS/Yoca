export const enum Message {
  FailedToFetchRequestedData,
  FailedToFetchExternalData,
  InternalServerError,
}

export const messageText = {
  [Message.FailedToFetchRequestedData]:
    "Failed to fetch requested data. Please try again later",
  [Message.FailedToFetchExternalData]:
    "Failed to fetch data from external sources",
  [Message.InternalServerError]:
    "There is a problem happended on the server. Please try again later.",
};
