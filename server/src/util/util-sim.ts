export function getEndpoint(path: string): URL {
  return new URL(`${process.env.SIM_API_BASE_URL}${path}`);
}

export function getRequiredHeaders() {
  return {
    "X-Sim-Api-Key": process.env.SIM_API_KEY!,
  };
}
