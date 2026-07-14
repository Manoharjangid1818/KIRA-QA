---
name: Global 401 auth-redirect pitfall
description: A global fetch-error handler that redirects to /login on any 401 breaks anonymous pages like /register.
---

A common SPA pattern dispatches a global "auth_error" event (or otherwise force-navigates to `/login`) whenever any API call returns 401, so an expired session bounces the user to sign-in. If this fires unconditionally, it also fires for the *expected* 401 from an anonymous `/auth/me` (or similar "who am I" probe) that every page — including `/login` and `/register` themselves — issues on mount. Result: visiting `/register` while logged out immediately redirects back to `/login` before the form ever renders.

**Why:** Found this while building a JWT-auth SPA; `/register` always showed the login form because the anonymous auth probe's 401 triggered the redirect on every page load.

**How to apply:** Only treat a 401 as "session expired" (and redirect) when the request actually carried a bearer token that got rejected. If no token was sent, the 401 is an expected "not logged in yet" response and must not redirect.
