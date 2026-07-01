import { useNavigate } from "react-router";
import { Flex } from "@/components/Flex";
import { Txt } from "@/components/Txt";
import { PageWrapper } from "@/components/wrapper/PageWrapper";
import { Button } from "@carbon/react";
import { ArrowRight } from "@carbon/icons-react";
import { useLocalization } from "@/contexts/LocalizationContext";

export default function NotFoundPage() {
  const navigate = useNavigate();
  const {tr, fmt} = useLocalization();
  
  return (
    <PageWrapper>
      <Flex align="center" justify="center" style={{ blockSize: 450 }}>
        <Flex dir="column" align="center" gap={20}>
          <Flex dir="column" align="center" gap={10}>
            <Txt uppercase secondary size="sm">
              {tr("errorPages.notFound.error404")}
            </Txt>

            <Txt size="2xl">
              {tr("errorPages.notFound.title")}
            </Txt>

            <Txt secondary size="md">
              {tr("errorPages.notFound.description")}
            </Txt>
          </Flex>

          {/* <form
            onSubmit={handleSearchSubmit}
            style={{ width: "100%", maxWidth: 500 }}
          >
            <Flex dir="row" gap={0}>
              <Search placeholder="Search" labelText="Search" size="lg"/>
            </Flex>
          </form> */}

          <Flex dir="column" gap={8} align="start" style={{ inlineSize: "100%" }}>
            <Txt secondary size="sm">
              Continue exploring
            </Txt>
            <Flex dir="row" gap={4} style={{ inlineSize: "100%" }}>  
              <Button 
                kind="primary"
                renderIcon={ArrowRight}
                onClick={() => navigate("/market")}
                style={{ flex: 1 }}
              >
                {tr("errorPages.notFound.goToMarket")}
              </Button>
               <Button 
                kind="secondary"
                renderIcon={ArrowRight}
                onClick={() => navigate("/")}
                style={{ flex: 1 }}
              >
                {tr("errorPages.notFound.backToHome")}
              </Button>
            </Flex>
          </Flex>
        </Flex>
      </Flex>
    </PageWrapper>
  )
}