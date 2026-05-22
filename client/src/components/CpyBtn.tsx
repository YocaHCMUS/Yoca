import { IconButton } from "@carbon/react";
import { Checkmark, Copy } from "@carbon/react/icons";
import { useState } from "react";

type CpyBtnProps = {
  size: "xs" | "sm" | "md" | "lg" | undefined;
  copyWhat: string | number;
  align?: "left" | "right" | "top" | "bottom";
};

export function CpyBtn({ size, copyWhat, align = "right" }: CpyBtnProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(String(copyWhat));
    setCopied(true);
    // Reset after 2 seconds
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <IconButton
      size={size}
      kind="ghost"
      label={copied ? "Copied" : "Copy"}
      align={align}
      onClick={handleCopy}
      data-export-hide="copy-button"
    >
      {copied ? <Checkmark /> : <Copy />}
    </IconButton>
  );
}
