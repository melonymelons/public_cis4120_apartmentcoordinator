# Connect nest. to Supabase

The integration is implemented but is not connected to a live project. Without the two environment variables, the existing local apartment remains available for preview. The existing local apartment remains available, but local-only mode deliberately does not fabricate join links or shared memberships. No existing local apartment is uploaded automatically.

## Setup

1. Open the [Supabase dashboard](https://supabase.com/dashboard), sign up or sign in, and create a project called **Nest** in your own organization. Keep its database password private. Wait for the project to finish provisioning.
2. Run the files in `migrations/` in filename order in that project's SQL Editor, once each. The first creates the tables and invitation APIs; `202611050001_single_apartment.sql` enforces one apartment per account. If the first migration was already applied, run only the new single-apartment migration. No membership is deleted automatically; existing duplicate memberships must be resolved explicitly before the unique index can be installed.
3. Open the project's **Connect** panel and copy its **Project URL** and **publishable key** (or legacy public anon key). Put them in a `.env.local` file using the variable names in [`.env.example`](../.env.example), or share these two public values with your coding assistant to configure the app. Never put the service-role key in browser code. Restart Vite after changing these values. See the [official React setup guide](https://supabase.com/docs/guides/getting-started/quickstarts/reactjs).
4. In Supabase Auth, enable email sign-in. Set the Site URL to your production origin. Add your local development origin and production callback URLs to the redirect allowlist. The email redirect retains `?invite=...`; allow the corresponding application paths. See [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).
5. Configure custom SMTP for public signups before launch. Supabase's default email service is for development and restricts recipients; see [the official SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp).
6. Set the same two **public** variables in Vercel and rebuild the deployment. Until then, the public build stays in local preview mode.

## Usage

Sign in using the email link. A new account starts without a household or demo roommates. Profile shows name, character, and color controls directly. If you have no apartment, choose **Set up apartment** or open a roommate’s invitation. Once you belong to an apartment, you cannot create or join a second one. To invite roommates to your apartment, choose **Invite members → Create invite link**. Copy the link or use **Email link**, which opens an email draft in your own mail application. This does not send an invitation email automatically.

Recipients open the link, sign in under their own email address, review the household name, and choose **Join household**. Each invitation expires after seven days and admits one new member. Generate a separate link for each person. Creators can revoke their links; the household creator can also revoke them through the RPC. Reopening a redeemed link as an existing member is idempotent.

Each account can belong to one apartment, enforced by a unique membership constraint and by the creation/redemption RPCs. The apartment owns its layout, objects, tasks, inventory, and member availability. The interface has no apartment switcher. Older local archives are preserved but are not selectable. Personal name/color/character are stored separately in the account's own profile. Members cannot modify other profiles or availability, including by calling the API directly. Household membership is created only by the create-household and accept-invite RPCs, using the authenticated user rather than a submitted user ID.

Shared data saves after a brief debounce. Other members' changes are refreshed on window focus and every 15 seconds while there are no pending local edits. Household revisions reject stale overwrites. A conflict asks the user to reload instead of silently overwriting another person's data. This is polling, not a realtime websocket implementation. The current implementation does not retain an offline write queue across page reloads.

## Validation

- `npm test`: local model, household isolation, and profile ownership checks.
- `npm run test:backend`: execute the actual migration in embedded PostgreSQL (PGlite), with mock Supabase Auth roles/identities, then test RLS, invite use/revocation/expiry, actor permissions, and revision conflicts.
- `npm run test:cloud-ui`: browser checks with the real Supabase client and intercepted HTTP responses, covering sign-in redirects, join confirmation, profile updates, invite creation/revocation, and versioned shared-data saves.

These tests do not provision a Supabase project, send real emails, or replace a final two-account check against your configured project. Once connected, create a household as account A, join it as account B on a separate device, confirm each can edit only their own profile/availability, and verify each sees saved household changes.
