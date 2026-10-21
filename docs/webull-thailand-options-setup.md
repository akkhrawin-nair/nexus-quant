# Webull Thailand: options data setup

## Current status

KAPPA has no connected live options feed. The new readiness command checks only
whether credential variables exist locally. It makes no network requests, verifies
no subscription, and cannot turn on live prices. Options recommendations remain
unavailable until a real quote integration is implemented and verified.

The intended workflow is US options with expiration within 14 calendar days and
positions held no longer than 14 calendar days. Those rules are a subsequent
implementation step; this setup check does not enforce them.

## Account steps

1. Sign in to the official Webull Thailand website yourself. Look for **Developer
   Tool**, **OpenAPI**, or **API Management / My Application**. Follow the
   [Thailand individual application process](https://developer.webull.co.th/apis/docs/authentication/individual-application/).
2. Confirm that the approved Thailand application can request US options quotes.
   Confirm the application region, production API endpoint, and any required token
   activation with Webull. Do not assume US account configuration applies to your
   Thai account.
3. Check the API application's options data entitlement. Webull documents
   **OPRA Real-Time Non-display** for options last sale and quotation; subscriptions
   in the mobile/desktop trading app are independent of OpenAPI. Ask Webull which
   entitlement is required for this personal dashboard and its calculations before
   buying a subscription. See the [market-data overview](https://developer.webull.com/apis/docs/market-data-api/overview/)
   and [Thailand market-data FAQ](https://developer.webull.co.th/apis/docs/market-data-api/faq/).
4. If API access or the required data is unavailable to your account, report that
   result before choosing a different provider. Do not substitute theoretical
   prices or delayed quotes and label them live.

## Local credential preparation

Once approved, open the root `.env` locally in your editor. Create it from
`.env.example` if it does not exist, preserving any existing settings. Add your
own values for these two names:

```dotenv
WEBULL_APP_KEY=
WEBULL_APP_SECRET=
```

Do not send credentials in chat. Do not put them in browser storage, frontend
source, or `VITE_` variables. The root `.env` is excluded by `.gitignore`.
No credentials are created or purchased by KAPPA.

From the project root, run:

```powershell
.\venv\Scripts\python.exe manage.py check_options_access
```

- `credentials_missing`: one or both variables are blank/missing. The output lists
  variable names only.
- `credentials_present_unverified`: both values exist, but may still be invalid,
  expired, or lack permissions. This does **not** mean connected or live.

## Acceptance for the next step

Before displaying prices, implement a read-only connector against the confirmed
Thailand endpoint and validate an actual options response. Webull documents an
[option snapshot endpoint](https://developer.webull.com/apis/docs/reference/option-snapshot/),
but that alone does not prove account access or supply all contract/quote details.
Verify symbol, expiration, call/put, strike, multiplier, bid/ask sizes, source quote
timestamps, and data entitlement. Fetch time must not replace quote time.

The UI should then distinguish bid, ask, last, and an estimated purchase cost.
An ask quote is a price reference; it does not guarantee a fill. No order placement
is part of this integration.
