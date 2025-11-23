/**
 * Google OAuth Authentication Button Component
 * Provides Google Sign-In functionality with custom Carbon Design System styling
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { GoogleLogin } from '@react-oauth/google';
import type { CredentialResponse } from '@react-oauth/google';
import { InlineNotification } from '@carbon/react';
import './GoogleAuthButton.module.scss';

/**
 * GoogleAuthButton Props
 */
interface GoogleAuthButtonProps {
  /**
   * Mode of authentication (sign-in or sign-up)
   */
  mode: 'signin' | 'signup';
  /**
   * Callback function called when Google authentication succeeds
   */
  onSuccess: (credential: string) => Promise<void>;
  /**
   * Callback function called when Google authentication fails or is cancelled
   */
  onError?: (error: string) => void;
  /**
   * Whether the button is disabled
   */
  disabled?: boolean;
}

/**
 * GoogleAuthButton Component
 * Integrates Google OAuth with Carbon Design System styling
 * 
 * @example
 * ```tsx
 * <GoogleAuthButton
 *   mode="signin"
 *   onSuccess={handleGoogleSuccess}
 *   onError={handleGoogleError}
 * />
 * ```
 */
export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  mode,
  onSuccess,
  onError,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  /**
   * Handle successful Google OAuth response
   */
  const handleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      const errorMsg = t('auth.googleAuthFailed');
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await onSuccess(credentialResponse.credential);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t('auth.googleAuthFailed');
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle Google OAuth error or cancellation
   */
  const handleError = () => {
    const errorMsg = t('auth.googleAuthCancelled');
    setError(errorMsg);
    onError?.(errorMsg);
  };

  /**
   * Get button text based on mode
   */
  const getButtonText = (): string => {
    if (isLoading) return t('common.loading');
    return mode === 'signin' ? t('auth.continueWithGoogle') : t('auth.signUpWithGoogle');
  };

  return (
    <div className="google-auth-button-container">
      {/* Error notification */}
      {error && (
        <InlineNotification
          kind="error"
          title={t('common.error')}
          subtitle={error}
          onCloseButtonClick={() => setError(null)}
          className="mb-4"
          lowContrast
        />
      )}

      {/* Google OAuth Button */}
      <div 
        className={`google-login-wrapper ${disabled || isLoading ? 'disabled' : ''}`}
        data-loading={isLoading}
        style={{ pointerEvents: disabled || isLoading ? 'none' : 'auto' }}
      >
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={handleError}
          text={mode === 'signin' ? 'signin_with' : 'signup_with'}
          shape="rectangular"
          theme="outline"
          size="large"
          width="100%"
        />
      </div>

      {/* Custom styled button overlay (optional - for Carbon integration) */}
      <div className="google-button-label">
        {getButtonText()}
      </div>
    </div>
  );
};
