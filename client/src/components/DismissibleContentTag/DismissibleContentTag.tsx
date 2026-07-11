import React, { ComponentProps } from "react";
import { Tag } from "@carbon/react";
import { Close } from "@carbon/react/icons";
import { Flex } from "../Flex";

interface CustomDismissibleTagProps
  extends Omit<ComponentProps<typeof Tag>, "children"> {
  children: React.ReactNode;
  onClose?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
}

export const DismissibleContentTag = ({
  children,
  onClose,
  disabled = false,
  ...tagProps
}: CustomDismissibleTagProps) => {
  const handleClose = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled && onClose) {
      onClose(event);
    }
  };

  return (
    <Tag
      {...tagProps}
      // We use the 'filter' variant to show the close button.
      // In Carbon v11+, 'filter' is the recommended way for dismissible tags.
      // filter
      disabled={disabled}
      // The 'Tag' component normally expects children – we pass them directly.
      style={{ paddingInlineStart: "1rem", paddingInlineEnd: disabled ? "1rem" : 0}}
    >
      <Flex align="center" justify="between" gap={0}>
        {children}
        {!disabled && (
          <button
            type="button"
            className="cds--tag__close-icon"
            onClick={handleClose}
            aria-label="Clear filter"
          >
            <Close />
          </button>
        )}
      </Flex>
    </Tag>
  );
};
