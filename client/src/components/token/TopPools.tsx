import { Link } from "react-router";
import Tble from "../Tble";

interface PoolData {
    name: string;
    address: string;
    volume24h: number;
    reserve: number;
}

interface TopPoolsProps {
    pools: PoolData[];
    tokenAddress: string;
}

export const TopPools = ({ pools, tokenAddress }: TopPoolsProps) => {
    if (!pools || pools.length === 0) return null;

    return (
        <div style={{ marginTop: "2rem" }}>
            <h3 style={{ marginBottom: "1rem" }}>Top Pools</h3>
            <Tble
                headers={[
                    { key: "name", header: "Pool" },
                    { key: "volume24h", header: "24h Volume" },
                    { key: "liquidity", header: "Liquidity" },
                ]}
                loading={false}
                rows={pools.map((pool) => ({
                    id: pool.address,
                    name: (
                        <Link
                            to={`/tokens/${tokenAddress}/${pool.address}`}
                            style={{ color: "#0f62fe", textDecoration: "none" }}
                        >
                            {pool.name}
                        </Link>
                    ),
                    volume24h: `$${pool.volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                    liquidity: `$${pool.reserve.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                }))}
            />
        </div>
    );
};
