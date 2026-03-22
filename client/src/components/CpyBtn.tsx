import { Tooltip } from "@carbon/react";
import { Checkmark, Copy } from "@carbon/react/icons";
import { useState } from "react";

type CpyBtnProps = {
  size: number;
  copyWhat: string | number;
};

export function CpyBtn({ size, copyWhat }: CpyBtnProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(String(copyWhat));
    setCopied(true);
    // Reset after 2 seconds
    setTimeout(() => setCopied(false), 2000);
  };

  return copied ? (
    <Tooltip defaultOpen label="Copied!">
      <Checkmark size={size} />
    </Tooltip>
  ) : (
    <Tooltip label="Copy">
      <Copy size={size} onClick={handleCopy} />
    </Tooltip>
  );
}
