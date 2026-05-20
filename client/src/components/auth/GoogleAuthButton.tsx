import client from "@/api/main";
import Google from "@/components/icons/Google.svg?react";
import { useLocalization } from "@/contexts/LocalizationContext";
import { Button } from "@carbon/react";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { useRef, useState } from "react";

interface GoogleAuthButtonProps {
  disabled: boolean;
  onSuccess: (userId: string) => void;
  onError: (err: string) => void;
}

export function GoogleAuthButton({
  disabled,
  onSuccess,
  onError,
}: GoogleAuthButtonProps) {
  const { tr } = useLocalization();
  const [googleErr, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const googleButtonContainerRef = useRef<HTMLDivElement>(null);

  const onGoogleSignInSuccess = async (
    credentialResponse: CredentialResponse,
  ) => {
    try {
      const token = credentialResponse.credential;

      if (!token) {
        const errMsg = tr("auth.googleAuthFailed");
        setError(errMsg);
        onError(errMsg);
        return;
      }

      const resp = await client.api.users.auth.google.$post({
        json: {
          token,
        },
      });

      if (resp.status == 200) {
        const res = await resp.json();
        setError(null);
        onSuccess(res.userId);
      } else if (resp.status == 400 || resp.status == 422) {
        const res = await resp.json();
        const errCode = res.errorCode;
        const errorMsg = tr(`ERROR.${errCode}`);
        setError(errorMsg);
        onError(errorMsg);
      } else if (resp.status == 500) {
        const errorMsg = tr("ERROR.INTERNAL_SERVER_ERR");
        setError(errorMsg);
        onError(errorMsg);
      } else {
        const errorMsg = tr("ERROR.GOOGLE_VERIFICATION_FAILED");
        setError(errorMsg);
        onError(errorMsg);
      }
    } catch (error) {
      const errorMsg = tr("ERROR.NETWORK_ERR");
      setError(errorMsg);
      onError(errorMsg);
      return;
    }
  };

  const onGoogleSignInError = () => {
    console.log("google close");
    const errorMsg = tr("auth.googleAuthCancelled");
    setError(errorMsg);
    onError(errorMsg);
  };

  // Hacky stuff to override google login button because it sucks
  const onGoogleBtnClick = () => {
    const container = googleButtonContainerRef.current;
    if (!container) return;
    const googleButton = container.querySelector("div[role=button]");
    if (googleButton instanceof HTMLElement) {
      googleButton.click();
      setIsSigningIn(true);
    }
  };

  return (
    <div>
      <Button
        kind="tertiary"
        renderIcon={Google}
        onClick={onGoogleBtnClick}
        disabled={disabled}
        style={{
          inlineSize: "100%",
          maxInlineSize: "100%",
        }}
      >
        {tr("auth.continueWithGoogle")}
      </Button>
      <div ref={googleButtonContainerRef} style={{}}>
        <GoogleLogin
          onSuccess={onGoogleSignInSuccess}
          onError={onGoogleSignInError}
        />
      </div>
    </div>
  );
}
