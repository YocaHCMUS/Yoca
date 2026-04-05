import { Toggletip, ToggletipButton, ToggletipContent } from "@carbon/react";
import { Information } from "@carbon/icons-react";

interface InfoTooltipProps {
    text: string;
}

export function InfoTooltip({ text }: InfoTooltipProps) {
    return (
        <Toggletip align="top">
            <ToggletipButton label="More information">
                <Information size={14} />
            </ToggletipButton>
            <ToggletipContent>
                <p>{text}</p>
            </ToggletipContent>
        </Toggletip>
    );
}
