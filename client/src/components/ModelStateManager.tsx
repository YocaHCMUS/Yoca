import { useEffect, useState, type ReactNode } from "react";
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
  const [modalRoot, setModalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const mRoot = document.getElementById("modal-root");
    setModalRoot(mRoot);
  }, []);

  return (
    <>
      {modalRoot &&
        ReactDOM.createPortal(
          <ModalContent open={open} setOpen={setOpen} />,
          modalRoot,
        )}
      <LauncherContent open={open} setOpen={setOpen} />
    </>
  );
};
