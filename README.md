# Supperclub · Food Recipe App

Supperclub helps home cooks answer “What can I make with what I have?” A cook can look up an ingredient, narrow the results by cuisine or diet, follow the preparation steps, and save a dish for another day. Cooks can also submit a recipe for an administrator to review before it appears in the catalogue.

## Run the project

The project root is the directory containing `package.json`. Install Node.js 22.12 or newer with npm and run these commands from that directory.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. The server hosts both review editions.

| Review | URL path | Implementation |
| --- | --- | --- |
| Review 1 | `/review-1/` | HTML, CSS Grid/Flexbox and plain JavaScript, including role-based navigation. The entry point is `public/review-1/index.html`. |
| Review 2 | `/` | React components and JavaScript navigation, built and served with Vite. The components are in `src/`. |

To check a production build locally, run `npm run build`, then `npm run preview` and open the address it prints. In the downloadable review package, you can also double-click `dist/Open-Supperclub.html` after extracting it. This standalone React preview includes the photography, styles, and scripts in the HTML file. Use the hosted version to demonstrate share links that other people can open from their devices.

## Modules

| Role | What the reviewer can do |
| --- | --- |
| Guest | Browse the catalogue, search by ingredient, filter by cuisine or dietary preference, and follow a recipe one step at a time in Cook mode in the React edition. |
| User | Save dishes, organize collections, rate or share a recipe, and submit a dish for review. The React edition also lets a user plan breakfast, lunch, and dinner by date and check off the week's shopping list. |
| Admin | Sign in to the administration area, inspect submissions, and approve or decline them. Approval makes the recipe visible in this browser's catalogue. |

Choose **Create an account** and confirm a passphrase of at least 15 characters. After the account confirmation, sign in using the prefilled email and your passphrase. Existing accounts can use their original password.

**Reviewer admin account**

| Email | Password |
| --- | --- |
| `admin@supperclub.test` | `KitchenAdmin27!` |

## How it works

Both editions use the recipe catalogue and browser data API in `public/shared/`. The seeded dishes supply the initial catalogue. JavaScript reads the URL fragment to select the active screen and checks the session before opening account or admin functionality. CSS Grid arranges recipe cards, while Flexbox aligns controls and accommodates smaller screens.

The shared store uses Local Storage for accounts, the active session, collection memberships, individual votes, and submitted recipes. Passwords are salted and hashed with the browser's Web Crypto API. Signing out ends the session while keeping saved data. Updating a rating replaces the user's previous vote. The submission states are pending, approved, and rejected.

Each browser profile and site origin has its own records. For the moderation demonstration, switch accounts in **the same browser profile at the same URL origin**. A pristine browser starts with the seeded catalogue. Links to community recipes can carry a read-only copy of the recipe for a recipient. The published site serves a client-side classroom demo with administration and storage in the visitor's browser.

## Five-minute review walkthrough

1. **Discovery.** Open the home page. Search for an ingredient from one of the recipe cards, try a cuisine or dietary filter, then open a recipe and show its ingredients and numbered steps.
2. **Personalization.** Register and sign in. Save a dish to your cookbook, then schedule it for dinner in the meal planner. Open the shopping list, check off an ingredient, and refresh to show that the plan and checklist were saved.
3. **Participation.** Rate a recipe and change the rating once. Submit a dish with a title, cuisine, time, servings, ingredients, and instructions. Show its review status.
4. **Moderation.** Sign out and log in with the reviewer Admin account above. Open the pending submission and approve it.
5. **Verification.** Sign out, find the newly approved dish as a guest, and open its share link. Visit `/review-1/` at the same origin to demonstrate the plain JavaScript edition using the same data.

For a quick submission, try **Cumin potatoes**. Choose Indian cuisine, set 15 minutes and two servings, and enter the following ingredients and steps on separate lines.

| Ingredients | Preparation steps |
| --- | --- |
| 2 cooked potatoes, cubed | Warm the oil in a pan and toast the cumin until fragrant. |
| 1 tsp oil | Add the potatoes and salt. Stir occasionally until the edges turn golden. |
| ½ tsp cumin seeds | Serve warm. |
| Salt to taste | |

## GitHub and Vercel

Push the source directory containing `package.json` and `package-lock.json` to the project’s GitHub repository. Keep `node_modules` out of source control.

To deploy from GitHub, import that repository as a new Vercel project. Select the directory containing `package.json` as the root, choose the **Vite** framework preset, use **npm run build** for the build command, and **dist** for the output directory. Deploy, open the assigned production URL, and verify both `/` and `/review-1/`. Bring the repository link and the production deployment link to the review. [Vercel’s Vite guide](https://vercel.com/docs/frameworks/frontend/vite)
