import Google from "@/components/icons/Google.svg?react";
import { useLocalization } from "@/contexts/LocalizationContext";
import { Button, InlineNotification } from "@carbon/react";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import React, { useRef, useState } from "react";

interface GoogleAuthButtonProps {
  disabled: boolean;
  onSuccess?: (...args: any[]) => any;
  onError?: (...args: any[]) => any;
}

export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  disabled,
  onSuccess,
  onError,
}) => {
  const { tr } = useLocalization();
  const [googleErr, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const googleButtonContainerRef = useRef<HTMLDivElement>(null);

  const onGoogleSignInSuccess = async (
    credentialResponse: CredentialResponse,
  ) => {
    const token = credentialResponse.credential;

    if (!token) {
      const errorMsg = tr("auth.googleAuthFailed");
      setError(errorMsg);
      onError?.();
      return;
    }

    setError(null);
    setIsSigningIn(false);
    onSuccess?.(token);
  };

  const onGoogleSignInError = () => {
    const errorMsg = tr("auth.googleAuthCancelled");
    setError(errorMsg);
    onError?.();
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
      {googleErr && (
        <InlineNotification
          kind="error"
          title={tr("common.error")}
          subtitle={googleErr}
        />
      )}
      <Button
        kind="tertiary"
        renderIcon={Google}
        onClick={onGoogleBtnClick}
        disabled={disabled || isSigningIn}
        style={{
          inlineSize: "100%",
          maxInlineSize: "100%",
        }}
      >
        {tr("auth.continueWithGoogle")}
      </Button>
      <div ref={googleButtonContainerRef} style={{ display: "none" }}>
        <GoogleLogin
          onSuccess={onGoogleSignInSuccess}
          onError={onGoogleSignInError}
        />
      </div>
    </div>
  );
};
