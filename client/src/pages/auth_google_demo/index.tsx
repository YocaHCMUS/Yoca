import client from "@/api/main";
import {
  GoogleLogin,
  GoogleOAuthProvider,
  type CredentialResponse,
} from "@react-oauth/google";
import { useState } from "react";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID!;
console.log(import.meta.env);

function GoogleAuth() {
  const [status, setStatus] = useState("");

  const handleSuccess = async (credentialResponse: CredentialResponse) => {
    const token = credentialResponse.credential;

    if (!token) {
      setStatus("Authentication failed");
      return;
    }

    const resp = await client.api.users.auth.google.$post({
      json: { token },
    });

    if (resp.ok) {
      const res = await resp.json();
      setStatus(`Authenticated: ${res.userId}`);
    } else {
      setStatus("Authentication failed");
    }
  };

  const handleError = () => {
    setStatus("Google authentication error");
  };

  return (
    <div>
      <GoogleLogin onSuccess={handleSuccess} onError={handleError} />
      <div>{status}</div>
    </div>
  );
}

export function GoogleAuthDemo() {
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <>{googleClientId}</>
      <GoogleAuth />
    </GoogleOAuthProvider>
  );
}
