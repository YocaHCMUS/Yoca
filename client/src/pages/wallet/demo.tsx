import { useEffect, useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function SwrDebugDemo() {
  const [enabled, setEnabled] = useState(false);

  // simulate delayed enabling (like your tokenAddresses)
  useEffect(() => {
    setTimeout(() => {
      console.log("[>] Enabling fetch...");
      setEnabled(true);
    }, 1000);
  }, []);

  const { data, error, isLoading, isValidating } = useSWR(
    enabled ? "https://jsonplaceholder.typicode.com/todos/1" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
    },
  );

  console.log("[>] Render", {
    enabled,
    data,
    isLoading,
    isValidating,
    error,
  });

  return (
    <div style={{ fontFamily: "monospace" }}>
      <p>enabled: {String(enabled)}</p>
      <p>isLoading: {String(isLoading)}</p>
      <p>isValidating: {String(isValidating)}</p>
      <p>data: {data ? JSON.stringify(data) : "undefined"}</p>
      <p>error: {error ? "yes" : "no"}</p>
    </div>
  );
}
