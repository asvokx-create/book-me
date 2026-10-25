export const STRIPE_IDENTITY_SETUP_REQUIRED = "identity_api_invalid_application";

export function providerAgeVerificationError(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : null;

  if (code === STRIPE_IDENTITY_SETUP_REQUIRED) {
    return {
      code,
      status: 503,
      message: "Age verification is temporarily unavailable while BubsBookings finishes its Stripe verification setup. Please try again later.",
    };
  }

  return {
    code,
    status: 502,
    message: "We could not open Stripe age verification. Please try again in a moment.",
  };
}
