# Meta API Setup Guide (Sikasio)

Click-by-click guide to give WorkHub API control of Sikasio's Facebook Page + Instagram, starting from where you are now: **you already have a Business Portfolio**. Written for a non-developer ("Ahmed") — no coding. At the end you copy a short list of values into the server environment.

Set aside ~30–45 minutes. **Business Verification** (Part E) is started now but completes on Meta's schedule (often a few days), so begin it early.

> ### Terminology — Meta renamed things
> Meta recently **renamed "Business Manager" → "Business Portfolio."** Older docs (and some menus) still say "Business Manager" or "Business Account" — **they all mean the same thing: your Portfolio.**
>
> | This guide / your screen | Older name you might still see |
> | --- | --- |
> | **Business Portfolio** | Business Manager / Business Account |
> | **Settings** (gear, inside the Portfolio) | Business Settings |
>
> Other terms:
> - **Meta App** — a project at developers.facebook.com that holds your API permissions and tokens.
> - **System User** — a non-human "robot" member inside your Portfolio. It owns the long-lived token the WorkHub server uses. This is the stable, recommended way for a server to control your Pages.
> - **Token** — a long secret string the server sends to Meta to prove it's allowed to act on your Page/Instagram.

---

## How control actually works (read this first)

The WorkHub server controls your Page/Instagram through a **chain of ownership**. Every step below exists to build this chain:

```
Your Business Portfolio  ──owns──▶  Facebook Page + Instagram + Ad account
        │
        └──contains──▶  System User ("Sikasio Server")
                              │  is granted FULL CONTROL of those assets
                              │  + a token tied to your Meta App
                              ▼
                    WorkHub server uses that token  ──▶  posts, schedules, reads insights
```

So the job is: **(A)** make sure your Portfolio *owns* the Page + Instagram, **(B)** create a Meta App, **(C)** create a System User, give it *full control* of those assets, and generate its token. That token is what lets WorkHub (me, on the server) control your Pages.

---

## Before you start — what you'll need

- A personal Facebook account that is an **admin** of the Sikasio Facebook **Page**.
- The Sikasio **Instagram** login (on your phone).
- A safe place to paste secrets temporarily (a password manager is ideal). **Never** put these secrets in a public doc, chat, email, or git.

---

# Part A — In your Business Portfolio (business.facebook.com)

You said you already have a **Portfolio** — good, **reuse it**, don't create a new one. This part makes sure it *owns* the Page, Instagram, and an Ad account, so a System User can later be given control of them.

## A1 — Open your Portfolio's Settings

1. Go to **https://business.facebook.com** and log in.
2. Confirm the correct Portfolio is selected (top-left shows the Portfolio name — switch if you have more than one).
3. Open **Settings**:
   - In **Meta Business Suite**: click the **⚙ Settings** (gear) in the **bottom-left**, then **Business settings**, **or**
   - Go directly to **https://business.facebook.com/settings**.

You'll see a left sidebar with **Users**, **Accounts**, **Data sources**, **Security Center**, etc. Everything below lives here.

## A2 — Add & claim the Facebook Page

1. Left sidebar → **Accounts → Pages**.
2. Click **Add** → you'll see three choices:
   - **Add a Page** = *claim ownership* (your Portfolio owns it). **Choose this** — you own Sikasio.
   - *Request access to a Page* = for Pages someone else owns (not your case).
   - *Create a new Page* = only if the Sikasio Page doesn't exist yet.
3. Search for and select the **Sikasio Page**, confirm, and finish.
4. The Sikasio Page should now appear under **Pages** with your Portfolio as **owner**.

> If "Add a Page" says the Page is **already owned by another portfolio**, you'll have to either use that portfolio instead, or have its admin **remove** the Page so you can claim it here. A Page can be *owned* by only one portfolio.

## A3 — Add the Instagram account

1. Left sidebar → **Accounts → Instagram accounts**.
2. Click **Add** → **Connect your Instagram account** → log in to the **Sikasio Instagram**.
3. **Prerequisite:** the Instagram account must be a **Business or Creator** account and linked to the Sikasio Page. If it isn't yet, do this on your phone first:
   - Instagram app → your profile → **☰ menu → Settings and privacy → Account type and tools → Switch to professional account → Business**.
   - During/after the switch, choose to **connect the Sikasio Facebook Page** (or verify later from the Page: **Page → Settings → Linked accounts → Instagram → Connect**).
4. Back in the Portfolio, confirm the Sikasio Instagram now appears under **Instagram accounts**.

## A4 — Add (or create) an Ad account

*(Needed for Phase 2 paid ads; set it up now so you don't have to return.)*

1. Left sidebar → **Accounts → Ad accounts** → **Add**:
   - **Add an ad account** (enter its ID) if you already have one, **or**
   - **Create a new ad account**: name `Sikasio Ads`, set **time zone** and **currency** (⚠ these can't be changed later), finish.

✅ **End of Part A:** your Portfolio now *owns* the Page, the Instagram account, and an Ad account.

---

# Part B — Create a Meta App (developers.facebook.com)

The token in Part C is tied to an App, so create one.

## B1 — Create the app

1. Open **https://developers.facebook.com** → log in → top-right **My Apps** → **Create App**.
2. **App details**: **App name** `Sikasio Social`, **Contact email** = your email → **Next**.
3. **Use cases** — this is a **multi-select checklist** (tick the boxes on the right). Select:
   - ✅ **Manage everything on your Page** — the Pages API (publish, moderate, insights). **Essential.**
   - ✅ **Manage messaging & content on Instagram** — the Instagram API (publish, comments, DMs). **Essential.**
   - ✅ **Create & manage ads with Marketing API** — Phase 2 paid ads.
   - ☐ *(optional)* **Measure ad performance data with Marketing API** — Phase 2 ad insights.

   > ❌ **Do not** pick **"Other"** (Meta marks it *"going away soon"* and drops you into the deprecated old flow). Skip Facebook Login, Threads, WhatsApp, Catalog, etc. — not needed for the server/system-user approach.

   → **Next**.
4. **Business** — select your existing **Sikasio** portfolio. ⭐ This attaches the app to the portfolio, which is what **unlocks the "Add system user" button** in Part C. → **Next**.
5. **Requirements → Overview** — review → **Create app** (confirm your password if prompted). You land on the app **Dashboard**.

## B2 — Products are added automatically

The use cases you picked **auto-add the matching products** — **Pages API**, **Instagram API**, and **Marketing API** — so there's no manual "add products" step. (If one is ever missing, the app **Dashboard → Products (+)** lets you add it.) These enable the permissions you'll request in Part C.

---

# Part C — System User + full control + token (the key step)

This is what actually hands control to the WorkHub server.

## C1 — Add your app to the portfolio (unlocks system users)

The **Add system user** button stays **disabled** until an app belongs to the portfolio — Meta shows the tooltip *"an app must be part of this business portfolio."* Fix it:

1. **Settings → Accounts → Apps → Add → Add an app**.
2. Enter your **App ID** for **Sikasio Social** → **Add**.
   - Find the App ID at **developers.facebook.com → your app → App settings → Basic → App ID** (also shown atop the app Dashboard).

## C2 — Create the System User

1. **Settings → Users → System users** → the **Add** button (top-right) is now enabled → click it.
2. **Name** = `Sikasio Server` → **Role** = **Admin** → **Create system user**.

> Still disabled after adding the app? Enable **2FA** on your account (`accountscenter.facebook.com → Password and security`) and confirm you're a portfolio **Admin**.

## C3 — Give it FULL CONTROL of your assets

With **Sikasio Server** selected, click **Assign assets** (or **Add assets**) and assign each, toggling **Full control**:

- **Apps** → **Sikasio Social** → enable **Full control** (Manage app) → **Save**.
  - ⚠ **Required, and easy to miss.** Without an app role, the token screen shows *"No permissions available."* This is what makes the permission list appear in C4.
- **Pages** → **Sikasio Page** → enable **Full control** (Manage Page) → **Save**.
- **Instagram accounts** → **Sikasio Instagram** → enable **Full control** → **Save**.
- **Ad accounts** → **Sikasio Ads** → enable **Manage ad account / Full control** → **Save**.

> Greyed-out toggle = your Portfolio doesn't *own* that asset yet → go back to Part A and add/claim it, then return. **This step is the whole point** — without Full control here, the token can't control the Page.

## C4 — Generate the token

1. With **Sikasio Server** selected → **Generate new token**.
2. **App**: choose **Sikasio Social** (Part B).
3. **Token expiration**: choose **Never** if offered (system-user tokens are long-lived).
4. Tick **all** of these permissions (scopes):
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `pages_manage_engagement`
   - `pages_read_user_content`
   - `instagram_basic`
   - `instagram_content_publish`
   - `instagram_manage_insights`
   - `business_management`
5. **Generate token** → **copy it immediately** to a safe place. **Meta shows it only once.** This is your **`META_SYSTEM_TOKEN`**.

> **Paid ads (Phase 2):** organic posting + insights do **not** need ad scopes. When we turn on ads later, regenerate/edit the token and additionally tick `ads_management` and `ads_read` — those two also require **Business Verification** (Part E) approved first.

---

# Part D — Record the IDs the server needs

Easiest tool: **Graph API Explorer** → **https://developers.facebook.com/tools/explorer**. At the top, select app **Sikasio Social** and your system-user token in the token dropdown.

## D1 — Page ID → `META_PAGE_ID`
- **Graph API Explorer**: type `me/accounts` → **Submit** → find the Sikasio Page → copy its **`id`**, **or**
- **From the Page**: Sikasio Page → **About / Page transparency** → **Page ID**.

## D2 — Instagram user id → `META_IG_USER_ID`
In Graph API Explorer (replace `{page-id}`):
```
GET /{page-id}?fields=instagram_business_account
```
Response:
```json
{ "instagram_business_account": { "id": "17841400000000000" }, "id": "1029384756" }
```
Copy **`instagram_business_account.id`** → that's `META_IG_USER_ID`.
> If it's missing/null, the Instagram account isn't professional or isn't linked to the Page → revisit A3.

## D3 — Ad Account id → `META_AD_ACCOUNT_ID`
- **Settings → Accounts → Ad accounts → Sikasio Ads** → read the **Ad account ID** (a number).
- The API needs the **`act_` prefix**: ID `1234567890` → `META_AD_ACCOUNT_ID=act_1234567890`.

---

# Part E — Start Business Verification now

Reviewed by Meta, **can take several days**, and **gates paid ads** (Phase 2). Start it early; Phase 1 organic posting works without it.

1. **Settings → Security Center**.
2. Find **Business verification** → **Start verification**.
3. Provide business details (legal name, address, phone, website) and any documents Meta requests (e.g. a business document matching the name/address).
4. Submit, then check back over the next few days (Meta emails you; status shows in Security Center).

---

# Part F — Cloud Scheduler (fires scheduled posts every minute)

WorkHub publishes *scheduled* posts when an external scheduler "pings" a server endpoint once a minute. We use **Google Cloud Scheduler**.

> `META_CRON_SECRET` is a password **you invent** so only your scheduler can trigger publishing. Make it long & random (32+ chars). Use the **same** value here and in the server env (Part G).

1. **https://console.cloud.google.com/cloudscheduler** → select/create a Google Cloud project → **Enable** the Cloud Scheduler API if prompted.
2. **Create job**:
   - **Name**: `workhub-social-cron`
   - **Region**: near your users (e.g. `europe-west1`).
   - **Frequency**: `* * * * *` (every 1 minute).
   - **Timezone**: your business timezone.
3. **Target**:
   - **Target type**: **HTTP**
   - **URL**: `https://<workhub-host>/api/social/cron/run` (replace `<workhub-host>`, e.g. `https://app.sikasio.com/api/social/cron/run`)
   - **HTTP method**: **POST**
   - **Header** → Name `x-cron-secret`, Value = your `META_CRON_SECRET`.
   - **Body**: empty.
4. **Create**. (Optional) **⋮ → Force run** to test — `200` = healthy; `401`/`403` = the header doesn't match the server's `META_CRON_SECRET`.

---

# Part G — Paste these into the server environment

Give these to whoever manages the WorkHub server (or paste into the host's **Environment Variables**). **Server-only secrets — never expose in the browser or commit to git.**

| Variable | What to paste | From |
| --- | --- | --- |
| `META_SYSTEM_TOKEN` | The long token string | C3 |
| `META_PAGE_ID` | The Page ID number | D1 |
| `META_IG_USER_ID` | The Instagram business account id | D2 |
| `META_AD_ACCOUNT_ID` | `act_` + your ad account number | D3 |
| `META_GRAPH_VERSION` | `v21.0` (leave as-is) | fixed default |
| `META_CRON_SECRET` | The random secret you invented | F |

```
META_SYSTEM_TOKEN=EAAB...your-long-token...
META_PAGE_ID=1029384756
META_IG_USER_ID=17841400000000000
META_AD_ACCOUNT_ID=act_1234567890
META_GRAPH_VERSION=v21.0
META_CRON_SECRET=your-long-random-secret
```

Once saved and the Cloud Scheduler job is running, WorkHub can post to the Sikasio Page + Instagram, read insights, and publish scheduled posts automatically.

---

## Quick troubleshooting

- **"Add system user" button disabled** → no app is in the portfolio yet → add your app (C1).
- **"No permissions available" on the token screen (C4)** → the system user has no role on the app → assign **Apps → Sikasio Social → Full control** to the system user (C3).
- **Greyed-out "Full control" toggle (C3)** → your Portfolio doesn't *own* the asset → claim/add it in Part A.
- **"Page already owned by another portfolio" (A2)** → only one portfolio can own a Page; use that portfolio or have its admin release the Page.
- **`instagram_business_account` is null (D2)** → Instagram isn't professional or isn't linked to the Page (A3).
- **Token works but posting fails** → re-check the System User has **Full control** of the Page + Instagram (C3).
- **Scheduler returns 401/403** → `x-cron-secret` ≠ `META_CRON_SECRET` (Parts F & G).
- **Can't tick `ads_management` / `ads_read`** → Phase 2 scopes; need **Business Verification** approved (Part E).
- **Lost the token** → generate a new one (C4) and update `META_SYSTEM_TOKEN`; delete the old one.
```
