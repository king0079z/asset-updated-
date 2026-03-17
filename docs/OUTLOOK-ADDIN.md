# Outlook Add-in — Submit Ticket from the Ribbon

The Asset AI Outlook add-in adds a **Submit Ticket** button to the Outlook ribbon. Users can open the task pane and submit a ticket without leaving Outlook. When viewing or composing an email, the subject and body can be prefilled into the ticket form.

## Features

- **Ribbon button** in Read and Compose modes (Message Read + Message Compose)
- **One-click** open task pane; sign in once, then submit tickets with title, description, and priority
- **Optional prefill** from the current email (subject → title, body → description) when available
- **Source tracking**: tickets created from the add-in are marked with source `OUTLOOK` in the app

---

## What is the app domain? (Do I need to create it?)

**You do not create the app domain.** It is the public URL where your Asset AI app is already (or will be) deployed.

- **If you deploy with Vercel** (as this project is set up):  
  After you deploy, Vercel gives you a URL automatically, for example:
  - **Production**: `https://<your-project-name>.vercel.app`  
    (e.g. `https://assetai.vercel.app` if the Vercel project is named `assetai`.)
  - You can also add a **custom domain** in the Vercel dashboard (e.g. `https://assets.yourcompany.com`).

- **How to find your app domain**
  1. Open your app in a browser (the URL you use to log in to Asset AI).
  2. The **app domain** is the host part of that URL (no path, no trailing slash).  
     Examples:
     - If you open `https://assetai.vercel.app/login` → app domain is `assetai.vercel.app`
     - If you open `https://assets.mycompany.com/dashboard` → app domain is `assets.mycompany.com`

- **Manifest URL** (what you use in Outlook / admin center):
  ```text
  https://<APP_DOMAIN>/api/outlook/manifest
  ```
  Example: `https://assetai.vercel.app/api/outlook/manifest`

The `/api/outlook/manifest` endpoint fills in the correct domain in the manifest automatically based on the request, so you only need to use the URL above with your real app domain—no extra configuration to “create” a domain.

**When I open the manifest URL in a browser, it says "This XML file does not appear to have any style information". Is that an error?**  
No. That message is normal. Browsers show it for any XML that doesn't have a stylesheet. The manifest is valid. Use the same URL in Microsoft 365 admin center or Outlook (Add from URL)—Microsoft will fetch the XML and install the add-in correctly.

---

## How to install the add-in (single user / testing)

Use this for trying the add-in yourself or for a small group before rolling out to the whole company.

### Install by uploading a file (use this when only "Upload file" / "Add from file" is available)

Many Outlook clients and admin centers only offer **Upload file** / **Add from file**. Do this:

**Step 1 — Download the manifest**

1. In a browser, open: `https://YOUR_APP_DOMAIN/api/outlook/manifest` (e.g. `https://assetxai.live/api/outlook/manifest`).
2. You may see the XML or a "no style information" message; that’s fine.
3. Save the page: **Ctrl+S** (Windows) / **Cmd+S** (Mac) → choose a folder → file name `asset-ai-outlook-manifest.xml` → **Save as type: All files** → Save.  
   Or right-click the page → **Save as…** → save as **All files** with a `.xml` name.
4. Note where you saved the file.

**Step 2 — Install using the file**

- **Outlook on the web:** Get Add-ins → **My add-ins** → **Add a custom add-in** → **Add from file** → select the saved `.xml` → **Install**.
- **Outlook desktop:** **Get Add-ins** → **My add-ins** → **Add a custom add-in** → **Add from file** → select the saved `.xml` file.
- **Microsoft 365 admin center:** Settings → Integrated apps → **Upload custom app** → **Upload manifest file** → select the saved `.xml` → complete the wizard.

The manifest already has your app URL; no need to edit the file.

### Option: Add from URL (if it appears)

If your client shows **Add from URL**: use **Add from URL** and enter `https://YOUR_APP_DOMAIN/api/outlook/manifest`. If you only see **Add from file**, use the upload steps above.

Details: [Sideload Outlook add-ins for testing](https://learn.microsoft.com/en-us/office/dev/add-ins/outlook/sideload-outlook-add-ins-for-testing).

---

## How to mass push the add-in to the entire enterprise

Use **centralized deployment** so every user in your organization (or chosen groups) gets the add-in automatically, without installing it themselves.

### Requirements

- **Microsoft 365** with Exchange Online (cloud mailboxes). On-premises Exchange is not supported for centralized deployment.
- **Licenses**: Users need Microsoft 365 / Office 365 plans that include Outlook (e.g. E1, E3, E5, F3, Business).
- **Admin role**: You need a role that can manage integrated apps (e.g. Global admin, Exchange admin, or a custom role with add-in management).

### Step 1: Get your manifest URL

Your app must be deployed over HTTPS. The manifest URL is:

```text
https://YOUR_APP_DOMAIN/api/outlook/manifest
```

Example: `https://assetai.vercel.app/api/outlook/manifest`  
This URL returns the XML manifest with all add-in URLs set to your domain.

### Step 2: Add the add-in in Microsoft 365 admin center

1. Go to **[Microsoft 365 admin center](https://admin.microsoft.com)** and sign in with an admin account.
2. In the left pane, open **Settings** → **Integrated apps**.
3. Click **Upload custom app** (or **Add** / **Deploy Add-in**, depending on your tenant).
4. **If "Add from URL" is available:** Choose it and paste the manifest URL. **If only "Upload manifest file" is available:** Open `https://YOUR_APP_DOMAIN/api/outlook/manifest` in a browser, save as `asset-ai-outlook-manifest.xml` (Save as type: All files), then choose **Upload manifest file** and select that file.
5. Paste your manifest URL (or skip if you uploaded a file):  
   `https://YOUR_APP_DOMAIN/api/outlook/manifest`
6. Click **Next**. Microsoft will fetch and validate the manifest.
7. Confirm the add-in name (e.g. “Asset AI – Submit Ticket”) and proceed.

### Step 3: Assign to the whole organization (mass push)

1. When asked **Who should have access?**, choose one of:
   - **Everyone** – entire organization (recommended for enterprise-wide rollout).
   - **Specific users/groups** – select users or Microsoft 365 / security groups if you want to limit rollout.
2. Optionally set **User consent** (e.g. allow the add-in to run without extra prompts).
3. Complete the wizard and **Deploy** (or **Turn on**).

### Step 4: Wait for rollout

- **Timeline**: Add-ins can take **up to 24 hours** to show for all users. Updates can take up to **72 hours**.
- Users may need to **restart Outlook** or **refresh Outlook on the web** to see the new **Asset AI** tab and **Submit Ticket** button.

### Optional: Manage or remove the add-in later

- In **Settings** → **Integrated apps**, find **Asset AI – Submit Ticket**.
- You can change assignment (who has access), turn it off, or remove it. Changes again can take up to 24–72 hours to apply.

### Reference

- [Deploy Office Add-ins in the Microsoft 365 admin center](https://learn.microsoft.com/en-us/microsoft-365/admin/manage/manage-deployment-of-add-ins)
- [Centralized deployment of add-ins](https://learn.microsoft.com/en-us/microsoft-365/admin/manage/centralized-deployment-of-add-ins)
- [Centralized deployment FAQ](https://learn.microsoft.com/en-us/microsoft-365/admin/manage/centralized-deployment-faq)

---

## User flow

1. User opens Outlook and selects an email (or composes one).
2. Clicks **Asset AI** → **Submit Ticket** in the ribbon.
3. Task pane opens. If not signed in, user clicks **Sign in** and completes login in a dialog.
4. After sign-in, the token is passed back to the task pane; the form is shown.
5. User enters (or edits prefilled) title and description, chooses priority, and clicks **Submit ticket**.
6. Ticket is created with source `OUTLOOK` and appears in the Asset AI app like any other ticket.

## Technical notes

- **Auth**: The task pane uses cookie session when possible; otherwise it uses **Bearer token** auth. Sign-in is done in an Office dialog; the auth-callback page posts the Supabase access token to the opener, which stores it and sends it as `Authorization: Bearer <token>` on ticket submission.
- **API**: `POST /api/tickets` accepts `source: 'OUTLOOK'` and (optionally) `Authorization: Bearer <access_token>`.
- **Pages**: `/outlook/taskpane` (task pane UI), `/outlook/auth-callback` (dialog callback after login). Both are public and skip the main app shell and subscription checks.
