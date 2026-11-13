# Andrew Benedict I. Alcantara — portfolio

A static portfolio (plain HTML, CSS and JavaScript, no build step) hosted on GitHub Pages.
All content comes from Supabase and is edited at **/admin**.

- Live site: https://dr3wwww.github.io/
- Admin panel: https://dr3wwww.github.io/admin/

## How it fits together

| Piece | Where |
|---|---|
| Public page | `index.html`, `js/site.js`, `css/site.css` |
| Admin panel | `admin/index.html`, `js/admin.js`, `css/admin.css` |
| Supabase connection | `js/config.js` (URL + anon key), `js/db.js` |
| Database + storage setup | `supabase/setup.sql` |
| Design kit (tasteskill) | `assets/` (do not edit) |

Security: every table and the image bucket use row-level security. Anyone can **read**;
only users listed in `public.admins` can **insert, update or delete**. The anon key in
`js/config.js` is public by design and can only read.

---

## Setup (about 10 minutes)

### 1. Create the Supabase project
1. Go to https://supabase.com and sign in (GitHub sign-in is fine). The free plan is enough.
2. Click **New project**. Pick a name (e.g. `portfolio`), set a strong database password
   (save it in a password manager; the site never needs it), choose the region nearest you
   (e.g. Southeast Asia (Singapore)), and click **Create new project**. Wait for it to finish.

### 2. Run the SQL setup
1. In the project, open **SQL Editor** → **New query**.
2. Open `supabase/setup.sql` from this repo, copy all of it, paste it in, click **Run**.
3. You should see "Success. No rows returned". This creates the tables (with only your name
   filled in), the security rules, and the public `portfolio` image bucket.

### 3. Turn off public sign-ups
1. Open **Authentication** → **Sign In / Providers** (older dashboards: **Authentication → Providers / Settings**).
2. Turn **off** "Allow new users to sign up". (Even if someone did sign up, they still could not
   write anything, because they would not be in `public.admins`; this just keeps the user list clean.)

### 4. Create your admin account
1. Open **Authentication** → **Users** → **Add user** → **Create new user**.
2. Enter your email and a strong password. Tick **Auto Confirm User**. Click **Create user**.
3. Back in **SQL Editor**, run this one line with *your* login email:

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'your-login-email@gmail.com'
   on conflict do nothing;
   ```

   It should say "Success. 1 row" (or "INSERT 0 1").

### 5. Paste your keys into the config file
1. Open **Project Settings** → **API** (newer dashboards: **Project Settings → Data API** for the URL
   and **API Keys** for the key).
2. Copy the **Project URL** and the **anon public** key (newer dashboards may call it the
   *publishable* key; either works).
   **Never** copy the `service_role` / *secret* key anywhere in this repo.
3. Edit `js/config.js`:

   ```js
   export const SUPABASE_URL = 'https://abcdefghijklmnop.supabase.co';
   export const SUPABASE_ANON_KEY = 'eyJhbGciOi...';   // the anon / publishable key
   ```

4. Commit and push:

   ```bash
   git add js/config.js
   git commit -m "Connect Supabase"
   git push
   ```

   GitHub Pages redeploys in about a minute.

### 6. Allow your site's address for sign-in (optional but recommended)
**Authentication** → **URL Configuration** → set **Site URL** to `https://dr3wwww.github.io`.

### 7. Add your content
Go to https://dr3wwww.github.io/admin/, sign in, and fill in Profile, Social links, Skills,
Projects, Education and Certifications. Every save is live on the next page load. Sections with
no entries stay hidden.

---

## Working on it locally
Serve the folder over http (ES modules do not load from `file://`), for example:

```bash
npx serve .        # or: python -m http.server 8000
```

While `js/config.js` still has the placeholders, `localhost` shows sample content from
`dev/preview.json` if that file exists (it is git-ignored and never published); the live site shows
just your name until Supabase is connected.

## Notes
- Images: JPG, PNG, WebP, GIF or AVIF, up to 5 MB each. Replacing or deleting an image in the
  admin also removes the old file from storage.
- Reorder anything with the up/down arrows; project images reorder with the left/right arrows
  (the first one is the card cover).
- Social platforms with built-in icons: GitHub, LinkedIn, Facebook, Instagram, Email, X, YouTube,
  TikTok, Dribbble, Behance, plus "Custom link" with your own label.
