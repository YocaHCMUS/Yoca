import client from "@/api/main";
import Tble from "@/components/Tble";
import { PageWrapper } from "@/components/wrapper";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet } from "@/hooks/useGet";
import { Button, Column, Grid, Section, Stack } from "@carbon/react";
import { Add } from "@carbon/react/icons";
import { useMemo } from "react";

interface AlertRow {
  id: string;
  tokenAddress: string;
  alertType: string;
  period: string;
  createdAt: string;
  [key: string]: string;
}

export default function AlertsDemo() {
  const { fmt, tr } = useLocalization();
  const { user } = useAuth();

  const alerts = useGet(
    client.api.alerts,
    200,
    {},
    {
      enabled: !!user,
    },
  );

  const rows: AlertRow[] = useMemo(() => {
    if (!alerts.data) return [];
    return alerts.data.map((alert) => ({
      id: alert.id,
      tokenAddress: alert.tokenAddress,
      alertType: alert.alertType,
      period: alert.period,
      createdAt: fmt.datetime.datetime(alert.createdAt),
    }));
  }, [alerts, fmt]);

  const headers = useMemo(
    () => [
      { header: "Token Address", key: "tokenAddress", width: "30%" },
      { header: "Alert Type", key: "alertType", width: "25%" },
      { header: "Period", key: "period", width: "15%" },
      { header: "Created At", key: "createdAt", width: "30%" },
    ],
    [],
  );

  return (
    <PageWrapper noMarketTickers>
      <Grid fullWidth>
        <Column lg={16} md={8} sm={4} style={{ marginTop: 32 }}>
          <Section level={1}>
            <Stack gap={5}>
              <div>
                <h1>Alerts Demo</h1>
                <p>View all alerts for your account</p>
              </div>

              <Button kind="primary" renderIcon={Add}>
                Create New Alert
              </Button>

              <Tble
                rows={rows}
                headers={headers}
                title="Your Alerts"
                loading={alerts.isLoading}
                enablePagination
                pageSize={10}
              />

              {alerts.error && (
                <div style={{ color: "red" }}>Failed to load alerts</div>
              )}
            </Stack>
          </Section>
        </Column>
      </Grid>
    </PageWrapper>
  );
}
