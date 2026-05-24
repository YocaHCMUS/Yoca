import { SignInModal } from "@/components/auth";
import { Flex } from "@/components/Flex";
import { Txt } from "@/components/Txt";
import { PageWrapper } from "@/components/wrapper/PageWrapper";
import { useLocalization } from "@/contexts/LocalizationContext";
import { ArrowRight } from "@carbon/icons-react";
import { Button } from "@carbon/react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";


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
  const {tr, fmt} = useLocalization();

  const requestedPath = getRequestedPath(location.state);

  return (
    <PageWrapper>
      <Flex align="center" justify="center" style={{ height: 450 }}>
        <Flex dir="column" align="center" gap={20}>

        <Flex dir="column" align="center" gap={8}>
            <Txt uppercase>
              {tr("errorPages.unauthorized.error401")}
            </Txt>
          <Flex dir="column" align="center" gap={10}>

            <Txt size="2xl">
              {tr("errorPages.unauthorized.accessDenied")}
            </Txt>


            <Txt secondary size="md">
              {tr("errorPages.unauthorized.description")}
              
            </Txt>

            {requestedPath.length > 0 ? (
              <Txt secondary>
              {tr("errorPages.unauthorized.protectedPath", {
                $path:   <Txt mono>
                  {requestedPath}
                </Txt>
              })}
              </Txt>
            ) : null}
          </Flex>
        </Flex>


          <Flex dir="row" gap={4} style={{inlineSize: 400}}>
            <Button kind="primary"
              onClick={() => setIsSignInOpen(true)}
              style={{flex: 1}}
            >
              {tr("errorPages.unauthorized.login")}
            </Button>
            
            <Button kind="secondary"
            renderIcon={ArrowRight}
              onClick={() => navigate("/")}
              style={{flex: 1}}
            >
              {tr("errorPages.unauthorized.backToHome")}
            </Button>

          </Flex>
        </Flex>


        <SignInModal
          open={isSignInOpen}
          onClose={() => setIsSignInOpen(false)}
          redirectUrl={requestedPath}
        />
      </Flex>
    </PageWrapper>
  );
}
