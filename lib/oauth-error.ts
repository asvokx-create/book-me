const GOOGLE_SIGN_IN_ERRORS: Record<string, string> = {
  signup_disabled: "We could not find a BubsBookings account for that Google email. Create an account with Google first.",
  account_not_linked: "That Google email matches an existing account, but it could not be connected. Try again or log in with your password.",
  unable_to_link_account: "We could not connect that Google account. Try again or log in with your password.",
  account_already_linked_to_different_user: "That Google account is already connected to another BubsBookings account.",
  email_does_not_match: "The Google email does not match this BubsBookings account.",
  access_denied: "Google sign-in was canceled. You can try again whenever you are ready.",
  invalid_code: "Google sign-in expired before it could finish. Please try again.",
};

export function getGoogleSignInErrorMessage(code?: string, description?: string) {
  if (code && GOOGLE_SIGN_IN_ERRORS[code]) return GOOGLE_SIGN_IN_ERRORS[code];
  if (description?.trim()) return description.trim();
  return "Google sign-in could not be completed. Please try again or log in with your email and password.";
}
