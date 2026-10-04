# Google authentication setup

Phase 6 uses Supabase Auth's browser OAuth flow. The application code needs the
public Supabase URL and publishable/anon key in `.env`; the Google client secret
must remain only in Google/Supabase dashboards.

## Google Auth Platform

1. Create a Web application OAuth client.
2. Add the app origin under **Authorized JavaScript origins**. For local Vite
   development this is normally `http://localhost:5173`.
3. Add the callback URL shown by **Supabase Dashboard → Authentication →
   Sign In / Providers → Google** under **Authorized redirect URIs**. For a
   hosted Supabase project it normally has this form:
   `https://<project-ref>.supabase.co/auth/v1/callback`.
4. Copy the Google client ID and secret into the Supabase Google provider form
   and enable the provider.

## Supabase URL configuration

Under **Authentication → URL Configuration**:

- use `http://localhost:5173` as the local Site URL;
- add `http://localhost:5173/home` to Redirect URLs;
- add the corresponding exact production `/home` URL before deployment.

Production redirect URLs should be exact and use HTTPS. Never put the Google
client secret in a `VITE_*` variable or any frontend file.
