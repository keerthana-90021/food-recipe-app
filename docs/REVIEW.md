# Supperclub project review

## Problem and business system

A home cook needs to find a recipe that fits their ingredients, diet, and available time, then remember what to buy and how to prepare it. Supperclub combines a searchable cookbook, personal meal planning, and a review queue for recipes submitted by cooks.

## Evaluation checklist

| Requirement | Where to demonstrate it |
| --- | --- |
| Review 1 uses only HTML, CSS, and JavaScript | Open `/review-1/`. Its HTML loads the local catalogue, shared JavaScript store, and plain JavaScript controller. The responsive template uses CSS Grid and Flexbox. |
| Review 2 uses React and Vite | Open `/`. React components render the catalogue, recipe detail, user account, planner, and review screens. Run `npm ci` and `npm run build` from the project root to reproduce the Vite production build. |
| User module, Admin module, and navigation | Register a cook, then sign in and open My cookbook. An admin signs in to the review queue. Both editions check the active session and role when navigating to a protected page. |
| Signup and login with Local Storage | Register with a sample email and confirmed passphrase. The confirmation page prefills the email for a separate sign-in. Refresh after signing in, then sign out and verify saved recipes reappear on the next login. |
| Browse, search, and follow recipes | Select a cuisine, combine it with an ingredient search or dietary filter, and open a result. The detail page shows quantities, servings, total time, and preparation steps. |
| Save, collect, share, submit, and rate | Bookmark a dish, add it to a named collection, change a star rating, copy a recipe link, and submit a new dish for admin review. Publishing adds it to the current origin's catalogue. |
| Meal planning | In the React edition, plan breakfast, lunch, or dinner for a specific date. Selecting another week changes the plan and shopping list. Check off an item and reload. |
| GitHub source and Vercel deployment | Open the repository's latest commit on `main` and its Vercel deployment check. Use **Visit** on the deployment to open the live app. Append `/review-1/` to that same site's base URL for the classic edition. [GitHub repository](https://github.com/keerthana-90021/food-recipe-app) |

## A five-minute demonstration

1. **Find dinner.** Filter for Japanese cuisine and non-vegetarian recipes. Open *Skillet Teriyaki Salmon*. Show the ingredient quantities and ordered steps.
2. **Become a member.** Sign up, show the confirmation, and sign in to the same account. Save the recipe, create a collection called *Weeknight dinners*, and add the dish to it.
3. **Plan and cook.** Schedule the dish for Friday dinner, tick a shopping item, and refresh. Open Cook mode, start the kitchen timer, and complete the first step. Close and reopen Cook mode to resume.
4. **Review a contribution.** Submit a new recipe and sign in with the reviewer admin account listed in the README. Read the ingredients and method. Request a correction with feedback, sign back in as the cook to revise it, then approve the resubmission as admin.
5. **Verify sharing.** Open an approved community recipe, copy its link, and paste it into another browser profile. The recipient can read the recipe. Return to the original browser and open `/review-1/` to demonstrate the framework-free edition.

## Changes since the 34-recipe edition

- Both editions now have 46 built-in recipes across nine cuisines. Thirteen carry the Non-vegetarian tag. The twelve additions cover chicken, beef, shrimp, and fish across Indian, Italian, Mexican, Chinese, Japanese, and Korean cuisines.
- A submission can now identify meat or egg dishes. Both editions reject contradictory dietary labels. Admins can return a dish with feedback, cooks can revise it, and admins can withdraw a previously approved dish from this browser's catalogue.
- The React edition adds a filter-aware **Surprise me** picker and a **Reduce motion** preference. Cook mode remembers ingredient checks, completed steps, and a running or paused timer across a refresh.

## Questions a reviewer may ask

**Where is Mourya's account?** On the deployed site, open browser Developer Tools, then **Application → Local Storage → the site origin**. Account keys begin with `supperclub.v1/accounts/`. Each record contains the name, email, role, salt, password hash, and derivation settings. Successful login creates a separate session entry with an expiry. Signing out preserves the account and cookbook.

**Can another laptop log into the same account or see the same review queue?** Each browser profile and site origin maintains its own data. Use two accounts in the same profile and origin for the moderation demonstration. Independent devices would require a shared service for authentication, storage, and authorization.

**How is a recipe shared across devices?** A built-in recipe uses its stable catalogue ID. A link to a submitted recipe carries a readable copy of its recipe details in the URL fragment. Someone with that link can copy or forward it. Older copies can continue to exist after the author changes the original. Offline file sharing copies the recipe text.

**What does the admin check protect?** The UI and shared store enforce the role during normal use. A person who controls the browser can inspect or change its stored data. The published demo admin credential is intended for classroom evaluation. A public multi-user service would require server-side role checks and private administrative credentials.

**How do ratings and shopping quantities work?** Each local account has one current rating per recipe. Changing it replaces the previous vote. The planner adds matching ingredient descriptions with compatible units and retains other lines separately. Dietary tags support browsing and depend on the ingredients and products the cook actually uses.
