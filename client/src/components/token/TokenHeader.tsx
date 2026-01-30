import { Stack } from "@carbon/react";

interface TokenHeaderProps {
    name: string;
    address: string;
    imageUrl?: string;
}

export const TokenHeader = ({ name, address, imageUrl }: TokenHeaderProps) => {
    return (
        <Stack orientation="horizontal">
            <img
                width={48}
                src={imageUrl ?? "https://placehold.co/48x48"}
                alt={name}
            />
            <Stack orientation="vertical">
                <b>{name}</b>
                <em>{address}</em>
            </Stack>
        </Stack>
    );
};
