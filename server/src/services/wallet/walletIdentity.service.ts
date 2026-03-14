
// example function to fetch wallet identity from Helius API, refactor to integrate with orther services and handle errors appropriately
export const getWalletIdentity = async (address: string) => {
    const url = `https://api.helius.xyz/v1/wallet/${address}/identity?api-key=6808b4cf-ac1f-44e4-9366-27de36790033`;

    const response = await fetch(url);
    if (!response.ok) {
        if (response.status === 404) {
            console.log("No identity found for this address");
            return null;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const identity = await response.json();
    console.log(`Found: ${identity.name} (${identity.category})`);
    return identity;
};

