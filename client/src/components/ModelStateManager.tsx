import { useState, type ReactNode } from "react";
import ReactDOM from "react-dom";

type StateManagementProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

type ModalStateManagerProps = {
  renderLauncher: (props: StateManagementProps) => ReactNode;
  children: (props: StateManagementProps) => ReactNode;
};

export const ModalStateManager = ({
  renderLauncher: LauncherContent,
  children: ModalContent,
}: ModalStateManagerProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {ReactDOM.createPortal(ModalContent({ open, setOpen }), document.body)}
      {LauncherContent({ open, setOpen })}
    </>
  );
};
