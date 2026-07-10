import client from "@/api/main";
import Google from "@/components/icons/Google.svg?react";
import { useLocalization } from "@/contexts/LocalizationContext";
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
  const [, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const googleButtonContainerRef = useRef<HTMLDivElement>(null);

  const onGoogleSignInSuccess = async (credentialResponse: CredentialResponse) => {
    try {
      const token = credentialResponse.credential;
      if (!token) {
        const errMsg = tr("auth.googleAuthFailed");
        setError(errMsg);
        onError(errMsg);
        return;
      }

      const resp = await client.api.users.auth.google.$post({
        json: { token },
      });

      if (resp.status == 200) {
        const res = await resp.json();
        onSuccess(res.userId);
      } else {
        const errorMsg = tr("ERROR.GOOGLE_VERIFICATION_FAILED");
        setError(errorMsg);
        onError(errorMsg);
      }
    } catch {
      const errorMsg = tr("ERROR.NETWORK_ERR");
      setError(errorMsg);
      onError(errorMsg);
    }
  };

  const onGoogleSignInError = () => {
    const errorMsg = tr("auth.googleAuthCancelled");
    setError(errorMsg);
    onError(errorMsg);
  };

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
    <>
      <button
        type="button"
        onClick={onGoogleBtnClick}
        disabled={disabled || isSigningIn}
      >
        <Google />
        <span>Google</span>
      </button>
      <div style={{ display: "none" }} ref={googleButtonContainerRef}>
        <GoogleLogin
          onSuccess={onGoogleSignInSuccess}
          onError={onGoogleSignInError}
          useOneTap={false}
        />
      </div>
    </>
  );
}