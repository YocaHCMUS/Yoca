/**
 * Sign In Form Component
 * Provides email/username and password authentication with validation
 */

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { TextInput, PasswordInput, Button, InlineNotification } from '@carbon/react';
import { Login, Wallet } from '@carbon/icons-react';
import { signInSchema, type SignInFormData } from './schemas/signInSchema';
import { GoogleAuthButton } from './GoogleAuthButton';
import { useAuth } from '../../contexts';
import styles from './SignInForm.module.scss';

/**
 * SignInForm Props
 */
interface SignInFormProps {
  /**
   * Callback function called after successful sign-in
   */
  onSuccess?: () => void;
  /**
   * Callback function to open wallet modal
   */
  onOpenWalletModal?: () => void;
  /**
   * Callback to navigate to sign-up page
   */
  onNavigateToSignUp?: () => void;
}

/**
 * SignInForm Component
 * Handles user authentication with email/username and password
 * 
 * @example
 * ```tsx
 * <SignInForm onSuccess={() => navigate('/dashboard')} />
 * ```
 */
export const SignInForm: React.FC<SignInFormProps> = ({
  onSuccess,
  onOpenWalletModal,
  onNavigateToSignUp,
}) => {
  const { t } = useTranslation();
  const { signIn, googleSignIn } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Helper to translate error messages from Zod
  const translateError = (message: string | undefined): string | undefined => {
    if (!message) return undefined;
    // Check if it's a translation key (starts with 'validation.')
    if (message.startsWith('validation.')) {
      return t(message, { min: message.includes('passwordTooShort') ? '6' : '3' });
    }
    return message;
  };

  // Initialize React Hook Form with Zod validation
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    mode: 'onBlur', // Validate on blur for better UX
  });

  /**
   * Handle form submission
   * Authenticates user and handles success/error states
   */
  const onSubmit = async (data: SignInFormData) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Map our form data to the auth context expected format
      const authData = {
        usernameOrEmail: data.identifier,
        password: data.password,
      };
      
      const response = await signIn(authData);

      if (response.success) {
        // Call success callback if provided
        onSuccess?.();
      } else {
        // Display error message from authentication service
        setErrorMessage(response.error || t('validation.invalidCredentials'));
      }
    } catch (error) {
      setErrorMessage(t('validation.networkError'));
      console.error('Sign in error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle Google OAuth success
   */
  const handleGoogleSuccess = async (credential: string) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await googleSignIn({ credential, clientId: '' });

      if (response.success) {
        onSuccess?.();
      } else {
        setErrorMessage(response.error || t('auth.googleAuthFailed'));
      }
    } catch (error) {
      setErrorMessage(t('auth.googleAuthFailed'));
      console.error('Google sign in error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle Google OAuth error
   */
  const handleGoogleError = (error: string) => {
    setErrorMessage(error);
  };

  return (
    <div className={styles['sign-in-form-container']}>
      <div className={styles['sign-in-form-header']}>
        <h2 className={styles['header-title']}>{t('auth.signIn')}</h2>
      </div>

      {/* Error notification */}
      {errorMessage && (
        <InlineNotification
          kind="error"
          title={t('common.error')}
          subtitle={errorMessage}
          onCloseButtonClick={() => setErrorMessage(null)}
          className={styles['error-notification']}
          lowContrast
        />
      )}

      <form onSubmit={handleSubmit(onSubmit)} className={styles['form']}>
        {/* Username/Email field */}
        <TextInput
          id="identifier"
          labelText={`${t('auth.username')} ${t('common.or')} ${t('auth.email')}*`}
          placeholder={`${t('auth.username')} ${t('common.or')} ${t('auth.email')}`}
          {...register('identifier')}
          invalid={!!errors.identifier}
          invalidText={translateError(errors.identifier?.message)}
          disabled={isSubmitting}
        />

        {/* Password field */}
        <PasswordInput
          id="password"
          labelText={`${t('auth.password')}*`}
          placeholder={t('auth.password')}
          {...register('password')}
          invalid={!!errors.password}
          invalidText={translateError(errors.password?.message)}
          disabled={isSubmitting}
        />

        {/* Forgot password link */}
        <div className={styles['forgot-password-container']}>
          <a
            href="/forgot-password"
            className={styles['forgot-password-link']}
            tabIndex={isSubmitting ? -1 : 0}
          >
            {t('auth.forgotPassword')}
          </a>
        </div>

        {/* Submit button */}
        <Button
          type="submit"
          disabled={isSubmitting}
          size="lg"
          renderIcon={Login}
        >
          {isSubmitting ? t('common.loading') : t('auth.signIn')}
        </Button>

        {/* Divider */}
        <div className={styles['divider']}>
          <div className={styles['divider-line']}>
            <div className={styles['divider-border']}></div>
          </div>
          <div className={styles['divider-text-container']}>
            <span className={styles['divider-text']}>
              {t('auth.or')}
            </span>
          </div>
        </div>

        {/* Google OAuth button */}
        <GoogleAuthButton
          mode="signin"
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          disabled={isSubmitting}
        />

        {/* Wallet authentication button */}
        <Button
          kind="secondary"
          onClick={onOpenWalletModal}
          disabled={isSubmitting}
          size="lg"
          renderIcon={Wallet}
        >
          {t('auth.continueWithWallet')}
        </Button>

        {/* Sign up link */}
        <div className={styles['sign-up-section']}>
          <span className={styles['sign-up-text']}>
            {t('auth.wantAccount')}{' '}
          </span>
          <button
            type="button"
            onClick={onNavigateToSignUp}
            className={styles['sign-up-button']}
            disabled={isSubmitting}
          >
            {t('auth.signUp')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SignInForm;
