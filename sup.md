Yes! The Supabase CLI handles exactly this. Let me check your setup:
$ npx supabase --version 2>&1
2.109.1
$ Test-Path "C:\Users\DALPHE\OneDrive\Documents\Web Project\Ciento_webapp\ciento-immobilier\supabase\config.toml"
False
+ Thought: 763ms
Supabase CLI v2.109.1 is installed, but the project isn't linked yet. Let me set it up:
$ cd "C:\Users\DALPHE\OneDrive\Documents\Web Project\Ciento_webapp\ciento-immobilier"; npx supabase init 2>&1
AlreadyExists: FileSystem.makeDirectory (C:\Users\DALPHE\OneDrive\Documents\Web Project\Ciento_webapp\ciento-immobilier\supabase)
Try rerunning the command with --debug to troubleshoot the error.
+ Thought: 131ms
→Read supabase 
+ Thought: 301ms
The supabase/ folder exists with migrations but no config.toml. Let me create it:
# Wrote supabase\config.toml
[project]
id = "tkcfaotttwtxzdfhtnaj"

+ Thought: 525ms
Now let me check if you're logged into Supabase CLI and link the project:
$ cd "C:\Users\DALPHE\OneDrive\Documents\Web Project\Ciento_webapp\ciento-immobilier"; npx supabase projects list 2>&1
│
◒  Fetching projects◐  Fetching projects◓  Fetching projectsCannot find project ref. Have you run supabase link?

  
   LINKED | ORG ID               | REFERENCE ID         | NAME       | REGION         | CREATED AT (UTC)    
  --------|----------------------|----------------------|------------|----------------|---------------------
          | mosudyicywfdfdawludv | dcsnmvbtsmdbwrwbutph | NKDELIVERI | East US (Ohio) | 2026-07-03 02:38:22
+ Thought: 2.4s
$ Select-String -Path "C:\Users\DALPHE\OneDrive\Documents\Web Project\Ciento_webapp\ciento-immobilier\.env" -Pattern "SUPABASE" | ForEach-Object { $_.Line -replace '(VITE_SUPABASE_URL=).*','$1[REDACTED]' }
VITE_SUPABASE_URL=[REDACTED]
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrY2Zhb3R0dHd0eHpkZmh0bmFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0MjI0NzIsImV4cCI6MjA5OTk5ODQ3Mn0.TCFCFd9xYWsqYEU13GnZ0pxRxjLl8WIoC8H55juURoI
- Thought: 2.4s
The project ref is tkcfaotttwtxzdfhtnaj but it's not in the user's project list. They may not have this project set up on Supabase yet, or it might be under a different account. Let me inform the user about this and explain how to link and push migrations.

Actually, the user's Supabase URL is https://tkcfaotttwtxzdfhtnaj.supabase.co, which means the project exists (the URL works). But it's not showing in the CLI list. This could mean:
1. The project is under a different organization
2. The user needs to link it manually

Let me explain the workflow to the user.
Your CLI is logged in but only shows one project (NKDELIVERI with ref dcsnmvbtsmdbwrwbutph). Your .env uses project tkcfaotttwtxzdfhtnaj. These might be under different orgs.
Here's how the workflow works — pick whichever suits you:
Option 1: Link + Push (recommended)
# 1. Link to your remote project
npx supabase link --project-ref tkcfaotttwtxzdfhtnaj

# 2. Push all migrations to remote
npx supabase db push

# 3. After future migration edits, push again
npx supabase db push
Option 2: Reset remote DB (dangerous — wipes and re-creates)
npx supabase db reset
Option 3: Create a new migration and push
# Create a named migration file
npx supabase migration new add_property_form_indexes

# Edit the generated SQL file in supabase/migrations/
# Then push
npx supabase db push
Let me try linking now:
$ cd "C:\Users\DALPHE\OneDrive\Documents\Web Project\Ciento_webapp\ciento-immobilier"; npx supabase link --project-ref tkcfaotttwtxzdfhtnaj 2>&1
Unexpected error retrieving remote project status: {"message":"Your account does not have the necessary privileges to access this endpoint. For more details, refer to our documentation https://supabase.com/docs/guides/platform/access-control"}
Try rerunning the command with --debug to troubleshoot the error.
+ Thought: 683ms
The project tkcfaotttwtxzdfhtnaj is under a different Supabase account/org than the one your CLI is logged into. You have two choices:
Fix: Log into the right Supabase account
# 1. Log out
npx supabase logout

# 2. Log in to the account that owns project tkcfaotttwtxzdfhtnaj
npx supabase login

# 3. Link
npx supabase link --project-ref tkcfaotttwtxzdfhtnaj

# 4. Push migrations
npx supabase db push
Or: If the project doesn't exist yet on Supabase
You need to create it first at supabase.com/dashboard (https://supabase.com/dashboard), then the CLI can link to it.
Once linked, npx supabase db push will push all 7 of your migration files (001 through 007) to the remote database in order. After that, any time you create a new migration with npx supabase migration new <name>, just run npx supabase db push to deploy it.