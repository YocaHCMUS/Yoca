const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjM3ZGExMjYwLWZhODctNDFmYi1iZTI4LWNkNmFhNTg5Y2UzOCIsIm9yZ0lkIjoiNDkwMjQ3IiwidXNlcklkIjoiNTA0Mzk5IiwidHlwZUlkIjoiOWQ5MGNhZTctNTgzNy00OWZlLWEzMzMtMzFhODdmNjdkNGMzIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NjgzMTExOTYsImV4cCI6NDkyNDA3MTE5Nn0.1cf115zwI2EYtdd5vaW7g2xM2JS0JCxSN5dRIRxp6NA";
const tokenAddress = "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4";
const url = `https://solana-gateway.moralis.io/token/mainnet/${tokenAddress}/top-holders?limit=10`;

(async () => {
    try {
        console.log(`Fetching: ${url}`);
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "accept": "application/json",
                "X-API-Key": API_KEY,
            },
        });

        console.log(`Status: ${response.status} ${response.statusText}`);
        const text = await response.text();
        console.log(`Body: ${text}`);
    } catch (error) {
        console.error("Error:", error);
    }
})();
