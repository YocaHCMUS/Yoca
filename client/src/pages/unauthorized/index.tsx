import { Flex } from "@/components/Flex";
import { Txt } from "@/components/Txt";
import { PageWrapper } from "@/components/wrapper/PageWrapper";
import { useLocalization } from "@/contexts/LocalizationContext";
import { ArrowRight } from "@carbon/icons-react";
import { Button } from "@carbon/react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import styles from "./index.module.scss";

type UnauthorizedRouteState = {
  from?: string;
};

function getRequestedPath(state: unknown): string {
  if (typeof state !== "object" || state === null) {
    return "";
  }

  if (!("from" in state)) {
    return "";
  }

  const routeState = state as UnauthorizedRouteState;
  if (typeof routeState.from !== "string") {
    return "";
  }

  return routeState.from;
}

export default function UnauthorizedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const { tr } = useLocalization();

  const requestedPath = getRequestedPath(location.state);

  return (
    <PageWrapper
      authPopup={{
        isOpen: isSignInOpen,
        onClose: () => setIsSignInOpen(false),
        redirectUrl: requestedPath || "/",
      }}
    >
      <Flex align="center" justify="center" className={styles.page} style={{ blockSize: 450 }}>
        <Flex dir="column" align="center" gap={28}>
          <Flex dir="column" align="center" gap={8}>
            <Txt
              uppercase
              secondary
              size="sm"
              weight="semibold"
              style={{ letterSpacing: "0.12em" }}
            >
              {tr("errorPages.unauthorized.error401")}
            </Txt>
            <Flex dir="column" align="center" gap={12}>
              <Txt size="2xl" weight="bold">
                {tr("errorPages.unauthorized.accessDenied")}
              </Txt>

              <Txt secondary size="md" align="center" style={{ maxWidth: 380 }}>
                {tr("errorPages.unauthorized.description")}
              </Txt>

              {requestedPath.length > 0 ? (
                <Txt secondary size="sm">
                  {tr("errorPages.unauthorized.protectedPath", {
                    $path: <Txt mono>{requestedPath}</Txt>,
                  })}
                </Txt>
              ) : null}
            </Flex>
          </Flex>

          <Flex dir="row" gap={12} style={{ inlineSize: 400 }}>
            <Button
              kind="primary"
              onClick={() => setIsSignInOpen(true)}
              style={{ flex: 1 }}
            >
              {tr("errorPages.unauthorized.login")}
            </Button>

            <Button
              kind="secondary"
              renderIcon={ArrowRight}
              onClick={() => navigate("/")}
              style={{ flex: 1 }}
            >
              {tr("errorPages.unauthorized.backToHome")}
            </Button>
          </Flex>
        </Flex>
      </Flex>
    </PageWrapper>
  );
}
