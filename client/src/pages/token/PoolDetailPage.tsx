import { Link, useParams } from "react-router";
import PageWrapper from "../../components/wrapper/PageWrapper";
import { Stack } from "@carbon/react";

export default function PoolDetailPage() {
    const { address: tokenAddress, poolAddress } = useParams<{ address: string; poolAddress: string }>();

    return (
        <PageWrapper>
            <Stack orientation="vertical" gap={5}>
                <Link to={`/tokens/${tokenAddress}`} style={{ color: "#0f62fe", textDecoration: "none" }}>
                    ← Back to Token
                </Link>
                <h1>Pool Detail</h1>
                <p>This page is currently under maintenance or refactoring.</p>
                <p>Pool Address: {poolAddress}</p>
            </Stack>
        </PageWrapper>
    );
}
