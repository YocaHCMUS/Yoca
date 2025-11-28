export function isExpired(updatedAt: Date, timeToLive: number) {
  return Date.now() - updatedAt.getTime() > timeToLive;
}
