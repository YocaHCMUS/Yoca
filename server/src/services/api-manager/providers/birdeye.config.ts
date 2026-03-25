// Birdeye provider config
export const birdeyeConfig = {
    rateLimit: 1, // requests per second
    // Use `apiKeyEnvVar` to indicate which env var holds one or more
    // comma-separated API keys. Actual rotation is handled by
    // `server/src/util/api-key-manager.ts`.
    apiKeyEnvVar: 'BIRDEYE_API_KEY',
    endpoints: {
        // Define endpoints here
    },
    errorFormat: {
        // Static error format for Birdeye
    },
};
