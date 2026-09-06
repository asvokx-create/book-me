# Google sign-in

BubsBookings supports Google sign-in through Better Auth. The Google button is enabled only when both server-side environment variables are present.

## Google

Create an OAuth 2.0 Web application in Google Cloud and register:

- Authorized JavaScript origin: `https://bubsbookings.com`
- Authorized redirect URI: `https://bubsbookings.com/api/auth/callback/google`

Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to the DigitalOcean app as encrypted runtime variables.

## Account behavior

- The login page signs in existing social accounts only.
- The signup page explicitly creates a new social account and requires acceptance of the site policies.
- A verified matching email may link to the user's existing account instead of creating a duplicate.
- New social users are sent to account settings to add the phone number that Google does not provide.
