import client from "@/api/main";


export async function fetchLinkedWalletAddresses() {
    return client.api.profile["linked-wallets"].$get().then((resp) => {
        if (resp.status === 200) {
            return resp.json();
        } else {
            throw new Error(`Failed to fetch linked wallets: ${resp.status}`);
        }
    });
}

export async function linkWalletAddress(walletAddress: string) {
    return client.api.profile["linked-wallets"].$post({ json: { walletAddress } }).then((resp) => {
        if (resp.status === 201) {
            return resp.json();
        } else {
            throw new Error(`Failed to link wallet: ${resp.status}`);
        }
    });
}

export async function unlinkWalletAddress(walletAddress: string) {
    return client.api.profile["linked-wallets"].$delete({ json: { walletAddress } }).then((resp) => {
        if (resp.status === 200) {
            return resp.json();
        } else {
            throw new Error(`Failed to unlink wallet: ${resp.status}`);
        }
    });
}