# IT Master Tool on Cloudflare

Two apps, one database, signed in with each person's **Microsoft 365 work account**, the same login they use for Outlook and Teams:

| Address | Who can open it | What's on it |
|---|---|---|
| `/` (IT Schedule) | Everyone you add | Calendar, Weekly schedule, Who's in, Saturday shifts, Working remote |
| `/projects/` (Projects) | Everyone you add | Projects Calendar with Ongoing and Completed filters, progress notes |
| `/newhires/` (New Hires) | Everyone you add | New Hire Setup tool: new hires, term employees, employee transfers |
| `/inventory/` (Inventory) | Everyone you add | IT inventory with location folders, low stock alerts, Inventory On Order, sign-outs, and Inventory Metrics |
| `/timeoff/` (Time Off Tracker) | Managers only | PTO balances, coverage calendar, time off log, CSV export, who can sign in, email settings |

Everything runs on Cloudflare Pages with a D1 database. The server checks every request:

- People who aren't signed in only ever see the sign-in page.
- Staff never receive leave types, notes, balances, or the access list.
- Time off logged by a manager shows up on the schedule as **Out** right away, and can email the managers through Exchange (Step 10).

## How sign-in works

1. The sign-in page sends people to Microsoft's own login page. MFA and your Conditional Access policies apply as usual.
2. Microsoft sends them back with a one-time code. The site exchanges that code with Microsoft for the person's identity, using PKCE and a client secret only the server knows.
3. The site checks three things: that the sign-in came from **your** Entra tenant, that it was meant for **this** app, and that it matches the sign-in the person started.
4. The person is let in **only if their email is on the access list** (Time Off → Who can sign in). Being in your company's Microsoft tenant isn't enough on its own.
5. The site then keeps its own session cookie (HttpOnly, Secure). It expires after 4 hours of inactivity, and always after 12 hours.

No passwords are stored anywhere in this app.

## What's in this folder

| Path | What it is |
|---|---|
| `public/index.html` | IT Schedule page |
| `public/timeoff/index.html` | Time Off Tracker page (with access list and email settings) |
| `public/projects/index.html` | Projects page |
| `public/inventory/index.html` | Inventory page |
| `public/newhires/index.html`, `public/newhires/tool.html` | New Hires page and the New Hire Setup tool it shows |
| `public/orders/index.html` | Forwards the old Inventory On Order address to the Inventory page |
| `public/login/`, `public/login.js` | The "Sign in with Microsoft" page |
| `public/app.js`, `public/app.css` | Shared code and styling |
| `functions/_middleware.js` | Checks the sign-in on every request and keeps non-managers out of Time Off |
| `functions/api/[[path]].js` | The data, Microsoft sign-in, and access-list API |
| `lib/auth.js` | Microsoft sign-in and session helpers |
| `lib/mail.js` | Sends the time off emails through Exchange Online |
| `schema.sql` | Creates the database tables |
| `migrations/` | One-time updates for databases created by an earlier version |

Your current data is in a separate file, `seed-current-data.sql`. **Never commit it to GitHub.** It contains PTO details.

---

## Step 1: Put the code on GitHub

1. Create a **private** repository, for example `it-schedule`.
2. Upload everything in this folder: `public/`, `functions/`, `lib/`, `migrations/`, `schema.sql`, `README.md`, and `.gitignore`.
3. Do **not** upload `seed-current-data.sql`.

If you already uploaded the username/password version, replace the files with these. The old `public/account/` folder can be deleted.

## Step 2: Set up the D1 database

1. In Cloudflare, go to **Storage & databases → D1 SQL Database** and open `it-schedule`. Create it first if needed: Eastern North America location.
2. Open the **Console** tab and run the whole contents of `schema.sql`.
   - It's safe to run again on an existing database. It adds the Microsoft sign-in tables and removes the old username/password table. Schedules and PTO aren't touched.
   - **Already have a database from an earlier version?** Also run `migrations/002-starting-location.sql` once. It adds the Starting location column. If it says "duplicate column name", it was already done. Then run `migrations/003-projects-calendar.sql` once to add the Projects Calendar. Then run `migrations/004-project-progress.sql` once for the Completed and Ongoing project buttons. Then run `migrations/005-project-supplies.sql` once for Supplies Needed. Then run `migrations/006-project-equipment.sql` once for Equipment Needed. Then run `migrations/007-scissor-lift-location.sql` once for Where is Scissor Lift Currently. Then run `migrations/008-inventory.sql` once for Inventory. Then run `migrations/009-inventory-cost-image.sql` once for Item Cost and images. Then run `migrations/010-inventory-on-order.sql` once for Inventory On Order. Then run `migrations/011-project-inventory.sql` once for Inventory Needed on projects. Then run `migrations/012-sign-out-inventory.sql` once for Sign Out Inventory. Then run `migrations/013-inventory-history.sql` once for adding stock to existing items. Then run `migrations/014-inventory-metrics.sql` once for Inventory Metrics. Then run `migrations/015-item-types.sql` to move items onto the new item types. Then run `migrations/016-history-source.sql` once for Inventory History's Coming from column. Then run `migrations/017-inventory-pins.sql` once for inventory PINs, and have a manager set each person's 4-digit PIN by editing them on the Schedule page. Then run `migrations/018-project-department.sql` once for project departments. Then run `migrations/019-time-off-viewers.sql` once. Then run `migrations/020-new-month-schedule.sql` once for New Month Schedule requests. Then run `migrations/021-saturday-coverage.sql` once. To set the Time off PINs (Chris, Geoff, Valentina, Harry, Kelly and Kerry Monica), run the separate `set-pins.sql` file once (don't put it on GitHub). Each migration only needs to run once; skip any you've already run.
3. If you haven't imported your data yet, run the whole contents of `seed-current-data.sql`.
4. Check it worked by running `SELECT name FROM employees;`. You should see your 5 team members.
5. Delete `seed-current-data.sql` from your computer.

## Step 3: Create the Pages project and connect GitHub

1. Go to **Workers & Pages → Create → Pages → Connect to Git**. Select **Connect GitHub**, sign in, and choose **Only select repositories** with just this repo. Then pick the repo.
2. Build settings:
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `public`
3. Select **Save and Deploy**.
4. Note the address Cloudflare gives the project, for example `https://it-schedule.pages.dev`.

From now on, every commit to the repo's main branch redeploys the site automatically.

## Step 4: Connect the database

1. In the Pages project, go to **Settings → Bindings → Add → D1 database**.
2. Set the variable name to `DB` and choose `it-schedule`.

## Step 5: Register the sign-in app in Entra ID

1. In **entra.microsoft.com**, go to **Entra ID → App registrations → New registration**.
2. Set it up:
   - Name: `IT Master Tool Sign-in`
   - Supported account types: **Single tenant** (Lester Glenn only)
   - Redirect URI: platform **Web**, value `https://YOUR-PROJECT.pages.dev/api/auth/callback`
3. Select **Register**. On the Overview page, copy the **Application (client) ID** and the **Directory (tenant) ID**.
4. Go to **Certificates & secrets → New client secret**. Pick an expiry, set a calendar reminder to renew it, and copy the **Value** right away.
5. Go to **API permissions**. `User.Read` is already there. Select **Add a permission → Microsoft Graph → Delegated** and add `openid`, `profile`, and `email`. Then select **Grant admin consent for Lester Glenn**, so people aren't asked to approve it.
6. **Optional extra lock:** in **Entra ID → Enterprise applications → IT Master Tool Sign-in → Properties**, set **Assignment required?** to **Yes**. Then under **Users and groups**, assign your IT group. Microsoft will then refuse anyone outside that group before they ever reach the site.

If you add a custom address later (Step 8), add its callback URL here too, under **Authentication → Web → Redirect URIs**.

## Step 6: Add the settings to Cloudflare

1. In the Pages project, go to **Settings → Variables and secrets** and add:

   | Name | Type | Value |
   |---|---|---|
   | `MS_TENANT_ID` | Text | Directory (tenant) ID |
   | `MS_LOGIN_CLIENT_ID` | Text | Application (client) ID of **IT Master Tool Sign-in** |
   | `MS_LOGIN_CLIENT_SECRET` | **Secret** | Its client secret value |
   | `INITIAL_MANAGERS` | Text | Your Microsoft email and Chris's, comma-separated, e.g. `you@lesterglenn.com,cwolf@lesterglenn.com` |

2. Go to **Deployments**, open the latest one, and select **Retry deployment**.

People listed in `INITIAL_MANAGERS` are always let in as managers, even if someone removes them from the list in the app. Keep it to one or two trusted people. If you're upgrading from the password version, delete the old `SETUP_CODE` secret.

## Step 7: Sign in and add your team

1. Open the site and select **Sign in with Microsoft**. Sign in with an account listed in `INITIAL_MANAGERS`.
2. Select **Time Off Tracker →** and scroll to **Who can sign in**.
3. Select **Add a person** for each person on IT. Enter their name and the Microsoft email they use for Outlook, and choose:
   - **Staff:** schedule only
   - **Manager:** schedule and Time Off
4. They can sign in right away. There's nothing to send them except the site address.

## Step 8: Use your own address (optional)

1. In the Pages project, go to **Custom domains → Set up a custom domain** and add, for example, `it.lesterglenn.com`.
   - If lesterglenn.com's DNS is on Cloudflare, the record is created automatically.
   - If not, Cloudflare shows a CNAME record to add at your DNS provider.
2. In Entra, open **IT Master Tool Sign-in → Authentication**. Add `https://it.lesterglenn.com/api/auth/callback` as another Web redirect URI.

## Step 9: Test it

1. **As a manager:** sign in. You should see the schedule with a **Time Off Tracker →** button, and Time Off should show balances, the log, and the access list.
2. **As staff:** use an incognito window with a staff member's Microsoft account. They should see the schedule with "Out" for anyone on PTO, and no Time Off button. Going to `/timeoff/` directly shows "Time Off is for managers only."
3. **As someone not on the list:** they get through Microsoft's login, then see "You don't have access yet."
4. **Signed out:** in a fresh incognito window, any page should send you to the sign-in page.

Once everything checks out, stop using the claude.ai version so there's only one source of truth.

---

## Step 10: Email managers through Exchange (optional)

When a manager logs time off, the app can email the managers through your Microsoft 365 / Exchange Online. It sends from one dedicated mailbox, and Exchange is set up so the app can send **only** as that mailbox, never as anyone else.

Each email includes:
- who's off, the type, the dates, and the days charged
- the note and their remaining balance
- anyone else out on those dates
- who logged it, and a link to the Time Off Tracker

Saving time off never waits on the email. If Exchange has a problem, the entry is still saved.

You'll need an Exchange admin, and an Entra admin who can register apps.

### 10a. Create the mailbox it sends from

1. In the **Exchange admin center** (admin.exchange.microsoft.com), go to **Recipients → Mailboxes → Add a shared mailbox**.
2. Name it `IT Schedule` with the address `it-schedule@lesterglenn.com`. Shared mailboxes don't need a license.

### 10b. Register the mailer app in Entra

This is a separate app from the sign-in app in Step 5. Keep them apart, because this one can send mail.

1. In **entra.microsoft.com**, go to **Entra ID → App registrations → New registration**.
2. Name it `IT Schedule Mailer` and choose **Single tenant**. Leave Redirect URI empty. Select **Register**.
3. On the Overview page, copy the **Application (client) ID** and the **Directory (tenant) ID**.
4. Go to **Certificates & secrets → New client secret**. Pick an expiry, put a renewal reminder in your calendar, and copy the secret's **Value** right away.
5. **Don't add Mail.Send under API permissions.** Granting it there would let the app send as *any* mailbox. Exchange grants a narrower version in 10c.
6. Go to **Entra ID → Enterprise applications**, open **IT Schedule Mailer**, and copy its **Object ID**. This is a different ID from the app registration's.

### 10c. Let the app send only as that mailbox (Exchange Online PowerShell)

Run these as an Exchange admin. Replace the placeholders with your values.

```powershell
Install-Module ExchangeOnlineManagement   # first time only
Connect-ExchangeOnline

New-ServicePrincipal -AppId <CLIENT-ID> -ObjectId <ENTERPRISE-APP-OBJECT-ID> -DisplayName "IT Schedule Mailer"

New-ManagementScope -Name "IT Schedule Mailbox" -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'it-schedule@lesterglenn.com'"

New-ManagementRoleAssignment -App <CLIENT-ID> -Role "Application Mail.Send" -CustomResourceScope "IT Schedule Mailbox"

# Check it: should report InScope = True for Application Mail.Send
Test-ServicePrincipalAuthorization -Identity <CLIENT-ID> -Resource it-schedule@lesterglenn.com
```

Running the same test against any other mailbox should report **InScope = False**. That confirms the app can't send as anyone else. New permissions can take up to about 2 hours to start working.

### 10d. Add the settings to Cloudflare

1. In the Pages project, go to **Settings → Variables and secrets** and add:

   | Name | Type | Value |
   |---|---|---|
   | `MS_TENANT_ID` | Text | Directory (tenant) ID |
   | `MS_CLIENT_ID` | Text | Application (client) ID |
   | `MS_CLIENT_SECRET` | **Secret** | The client secret value |
   | `MAIL_FROM` | Text | `it-schedule@lesterglenn.com` |
   | `NOTIFY_EMAILS` | Text | Managers to email, comma-separated, e.g. `cwolf@lesterglenn.com,you@lesterglenn.com` |

2. Go to **Deployments → Retry deployment**.

### 10e. Test it

1. In the Time Off Tracker, find **Email notifications**. It should list who gets the emails.
2. Select **Send test email**.
   - If it works, the managers receive a test message.
   - If it doesn't, the error from Microsoft appears on screen. See the table below.

| Error mentions | Fix |
|---|---|
| `invalid_client` or "secret" | The client secret is wrong or expired. Make a new one (10b) and update `MS_CLIENT_SECRET`. |
| `AADSTS700016` or `AADSTS90002` | `MS_CLIENT_ID` or `MS_TENANT_ID` is wrong |
| `403` / `ErrorAccessDenied` | The Exchange permission (10c) isn't active yet. Wait up to 2 hours, or check `Test-ServicePrincipalAuthorization`. |
| `404` / mailbox not found | `MAIL_FROM` doesn't match the shared mailbox address |
| Test email lands in Junk | Mark it as not junk, or have your Exchange admin allow `it-schedule@lesterglenn.com` |

To change who gets emails later, edit `NOTIFY_EMAILS` and retry the deployment.

---

## Everyday tasks

| To do this | Do this |
|---|---|
| Give someone access | Time Off → Who can sign in → **Add a person** |
| Make someone a manager | **Edit** → Access: Manager |
| Someone leaves | **Remove** them here (they're signed out immediately), and disable their Microsoft account as usual |
| Someone can't sign in | Check their email in the list matches the one they use for Outlook. If "Assignment required" is on (Step 5), check they're in the assigned group. |
| Update the app | Commit changes to GitHub. Cloudflare redeploys automatically. |
| Change who gets time off emails | Edit `NOTIFY_EMAILS`, then retry the deployment |
| Sign-in or email stopped working | Most often an Entra client secret expired. Make a new one and update `MS_LOGIN_CLIENT_SECRET` or `MS_CLIENT_SECRET`. |

## Troubleshooting sign-in

| What you see | Likely cause |
|---|---|
| "Microsoft sign-in isn't set up yet" | One of the Step 6 settings is missing, or the deployment wasn't retried |
| Microsoft error AADSTS50011 (redirect URI mismatch) | The address you're using isn't listed as a redirect URI in Entra (Steps 5 and 8) |
| AADSTS7000215 (invalid client secret) | `MS_LOGIN_CLIENT_SECRET` is wrong or expired |
| AADSTS50105 (not assigned) | "Assignment required" is on and the person isn't in the assigned group |
| "You don't have access yet" | They signed in fine, but aren't on the **Who can sign in** list |
| "Sign-in expired" | They took over 10 minutes, or used the back button. Sign in again. |
| "Setup isn't finished: the D1 database binding…" | The binding isn't named exactly `DB` (Step 4) |
| "The database tables are missing" | `schema.sql` hasn't been run (Step 2) |

## Testing on your own computer (optional)

Microsoft sign-in needs a real Entra app, so local testing uses the same settings as production. Add `http://localhost:8788/api/auth/callback` as a redirect URI on the sign-in app.

1. Create `wrangler.toml`:
   ```
   name = "it-schedule"
   compatibility_date = "2025-07-18"
   pages_build_output_dir = "public"
   [[d1_databases]]
   binding = "DB"
   database_name = "it-schedule"
   database_id = "00000000-0000-0000-0000-000000000000"
   ```
2. Create `.dev.vars` with the four Step 6 settings.
3. Run:
   ```
   npx wrangler d1 execute DB --local --file=schema.sql
   npx wrangler pages dev public --d1 DB=00000000-0000-0000-0000-000000000000
   ```
4. Open http://localhost:8788.

Don't commit `wrangler.toml` or `.dev.vars`. Never set `MS_AUTHORITY` in Cloudflare. It exists only for automated testing, and it relaxes one sign-in check.
