# Supperclub project review

## Problem and system

A home cook needs a recipe that fits their ingredients, diet and available time. They also need to remember what to buy, follow a preparation method and share a dish. Supperclub combines recipe discovery, a personal cookbook and a moderated community catalogue.

## Evaluation checklist

| Requirement | Where to demonstrate it |
| --- | --- |
| HTML, CSS, JavaScript, Grid/Flexbox | Open `/review-1/`. Its HTML loads the catalogue, local data store and plain JavaScript controller. Inspect the responsive card grid and flexible navigation. |
| React and Vite | Open `/?edition=classroom` for the Review 2 React demonstration, then `/` for the shared final. Both use React components for the catalogue, account, detail, planner and admin screens. Reproduce the frontend with `npm ci` and `npm run build`. |
| Admin and User modules, JavaScript redirection | Sign in as a cook and open My cookbook, then use an admin account in another browser to open the submission queue. Try accessing the administration page as a cook. |
| Local Storage signup and login | Register and sign in at `/review-1/` for Review 1 and `/?edition=classroom` for Review 2. Inspect this origin's Local Storage, sign out and sign back in. For the shared final at `/`, demonstrate server-backed identity and a session cookie. [React classroom site](https://food-recipe-app-wheat-alpha.vercel.app/?edition=classroom) |
| Discovery and preparation | Combine cuisine, dietary preferences and ingredient search. Open a recipe to show quantities, servings and numbered steps. |
| Save, collect, rate, share and submit | Save a recipe, add it to a named collection, revise a rating and submit a dish for moderation. Share its published link with a fresh browser. |
| Meal planning and guided cooking | In the React edition, schedule a dish by date and meal, check a shopping item, start a kitchen timer and resume the next unfinished step. |
| Source and deployment | Open the site and match its production deployment in Vercel to the source commit on GitHub. [Final site](https://food-recipe-app-wheat-alpha.vercel.app/) · [Review 1 site](https://food-recipe-app-wheat-alpha.vercel.app/review-1/) · [Repository](https://github.com/keerthana-90021/food-recipe-app) · [Vercel project](https://vercel.com/desalakeerthana1503-7536/food-recipe-app) |

## A five-minute demonstration

1. **Find dinner.** Select Japanese and Non-vegetarian. Open *Skillet Teriyaki Salmon*, or use **Surprise me** to draw one of the matching dishes. Point out the quantities and steps.
2. **Register and cook.** Create a cook account, show the confirmation, and explicitly sign in. Save the dish to a collection called *Weeknight dinners*. Add it to Friday dinner, check a shopping item, and try the timer in Cook mode.
3. **Submit a dish.** Use *Cumin potatoes* as a quick example. For two servings, list two cooked potatoes, one teaspoon oil, half a teaspoon cumin seeds and salt. For the method, toast the cumin in oil, add cubed potatoes and salt, then stir until golden. Add a photo if available.
4. **Moderate from another browser.** Open the same final-site URL in a separate browser profile. Sign in with the deployment's private admin account. Inspect the dish and photo, return it with a specific correction, then let the cook revise and resubmit. Approve the revised recipe.
5. **Show what became public.** From a signed-out browser, open the published recipe link. For the course's Local Storage requirement, open `/?edition=classroom` and demonstrate the React signup and login flow. Open `/review-1/` to demonstrate the framework-free version.

## Questions a reviewer may ask

**Where are Mourya's sign-in details?** In the configured hosted final, signup saves the account and a salted scrypt password hash in the project's Redis database. An administrator can see the cook's account details in the users directory. Successful sign-in sets an HTTP-only session cookie valid for up to eight hours. In Review 1, inspect Developer Tools, then **Application → Local Storage** for the site. Account keys begin with `supperclub.v1/accounts/` and hold the name, email, role, salt and password hash. Signing out ends the active session.

**Why does a recipe submitted on one laptop appear on a second?** The hosted clients use the same API and database. A cook sees personal submissions, the administrator sees the review queue, and guests see approved recipes. Sign into the same deployment on each device. Vite on a laptop uses a separate local test database. Each Review 1 browser keeps its own records.

**What travels with my account?** Shared recipes, my submissions and their photos, my saved collections and my ratings use the hosted database. A meal plan, checked groceries, motion preferences and Cook mode progress stay with the browser where they were created.

**What happens to dishes entered before the shared service existed?** In the submission queue, the administrator can choose **Import from this browser** on the original browser profile and site origin. The imported dish is credited to the importing administrator and enters the shared review queue as pending. A different laptop cannot read those old browser records.

**Can a browser-local admin password control online moderation?** Online moderation requires a server-validated administrator session from the private deployment account. The published classroom credential signs into Review 1, the hosted React classroom edition and the standalone file. The server checks permissions again when a request would change shared data.

**What does deleting a cook do?** In the hosted final, the administrator can delete a regular account. The deletion ends its sessions and removes its submissions, photos, ratings and collections. Published dishes authored by that account also disappear from other cooks' saved lists. Use a disposable account to demonstrate this action.

**How is a recipe withdrawn?** An administrator can return it from the approved catalogue. Check the production menu and open its ordinary published link in a fresh browser. Text, screenshots and any earlier browser-only links containing a copied recipe may still exist independently.

**What is the recipe coverage?** There are 46 built-in dishes across nine cuisines. Thirteen carry the Non-vegetarian tag. The catalogue includes chicken, beef, shrimp and fish across Indian, Italian, Mexican, Chinese, Japanese and Korean cuisines. Vegetarian, vegan and other filters work alongside cuisine and ingredient search.
