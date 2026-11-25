# Supperclub

Supperclub helps home cooks find something to make with the ingredients they have. Its 46 recipes span nine cuisines, including Indian, Italian, Mexican, Chinese, Japanese and Korean. Thirteen recipes feature meat, poultry or seafood.

## Choose an edition

| Edition | Open | Data and access |
| --- | --- | --- |
| Final review | `/` | React and Vite with the same-origin `/api/kitchen` service. On a configured Vercel deployment, cooks on different devices can sign in, submit recipes and see the same approved catalogue. Admin credentials are private to the deployment. |
| Review 2 classroom | `/?edition=classroom` | The hosted React and Vite app uses Local Storage for signup, login, user data and moderation. Use this link to demonstrate the Review 2 Local Storage requirement. |
| Review 1 | `/review-1/` | Framework-free HTML, CSS Grid/Flexbox and JavaScript. Signup, login, role navigation, collections, ratings and moderation use this browser profile's Local Storage. |
| Offline demonstration | `dist/Open-Supperclub.html` in a packaged release, when included | Open the extracted HTML file to demonstrate the browser-local cookbook. The file has no connection to the online community. |

The hosted editions use the same production domain. The Vercel dashboard shows which GitHub commit is serving that domain. [Shared final site](https://food-recipe-app-wheat-alpha.vercel.app/) · [React classroom site](https://food-recipe-app-wheat-alpha.vercel.app/?edition=classroom) · [Review 1 site](https://food-recipe-app-wheat-alpha.vercel.app/review-1/) · [Vercel project](https://vercel.com/desalakeerthana1503-7536/food-recipe-app) · [GitHub source](https://github.com/keerthana-90021/food-recipe-app)

## Run locally

Use Node.js 22.12 or newer. Run these commands from the project directory containing `package.json`.

```sh
npm ci
npm run dev
```

Open the address Vite prints. The local service keeps test accounts, submissions and photos in the private, Git-ignored `.kitchen-dev/` directory. Refreshes and server restarts preserve this data. Regular tester signup works without configuring an administrator. For the local admin queue, copy `.env.example` to `.env.local`. Uncomment `SUPPERCLUB_DEV_ADMIN_EMAIL` and `SUPPERCLUB_DEV_ADMIN_PASSWORD`, fill in your own values, then restart Vite. Use a unique password of at least 15 characters.

Run `npm test` for the automated checks. Run `npm run build`, then `npm run preview` to exercise the production frontend against the local review service. For the final review use the same hosted HTTPS address on every device.

## Configure the Vercel project

1. Open the existing **food-recipe-app** project. In **Storage**, select **Create Database**, choose **Upstash for Redis**, and connect a project-specific Redis database to this project's **Production** environment. If a dedicated database is already connected, reuse it. For a free review deployment, select the free plan only when it is offered. [Project storage](https://vercel.com/desalakeerthana1503-7536/food-recipe-app/stores) · [Redis on Vercel](https://vercel.com/docs/redis)
2. Under **Settings → Environment Variables**, check the names below. Use either complete Redis pair with a token that allows writes. Set the admin email and a private password of at least 15 characters. Store the Redis token and admin password as secrets. All four values belong to the server. A `VITE_` prefix would expose a value to frontend code. [Project environment variables](https://vercel.com/desalakeerthana1503-7536/food-recipe-app/settings/environment-variables) · [Upstash REST credentials](https://upstash.com/docs/redis/features/restapi)
3. Confirm the linked GitHub repository, the **Vite** framework preset, `npm run build`, `dist`, and the root containing both `package.json` and `api/`. Deploy the commit with the backend. After changing environment variables, redeploy so the next production deployment receives them. Uploading `dist/` alone omits the API. [GitHub repository](https://github.com/keerthana-90021/food-recipe-app) · [Vercel environment changes](https://vercel.com/docs/environment-variables/managing-environment-variables)
4. Open **Visit** on the production deployment. From one browser, register a new cook, sign in and submit a dish. From another, sign in with the private admin account, inspect the submission and approve it. Open its link in a signed-out third browser to verify publication.

| Server variable | Value |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` or `KV_REST_API_URL` | HTTPS REST endpoint for the project's Redis database |
| `UPSTASH_REDIS_REST_TOKEN` or `KV_REST_API_TOKEN` | Corresponding standard read/write REST token |
| `SUPPERCLUB_ADMIN_EMAIL` | Private administrator email for the hosted site |
| `SUPPERCLUB_ADMIN_PASSWORD` | Private administrator password for the hosted site |

## Modules and accounts

A **guest** can browse, filter dishes, draw a suggestion from the filtered results, open preparation steps and use Cook mode. A **cook** can sign up, confirm a passphrase, sign in, save recipes into collections, rate them, plan meals, tick a shopping list and submit recipes for review. A submission can include a JPEG, PNG or WebP photo up to 10 MB, which the browser resizes before sending. An **admin** can inspect submissions and photos, publish or return recipes, edit or delete catalogue entries and manage registered cooks.

The hosted final shares accounts, approved dishes, submitted photos, moderation, saved collections and ratings across devices. Meal plans, shopping checks, motion preferences and cooking progress stay with their browser.

For the React classroom edition, Review 1 and the packaged offline demo, the classroom admin email is `admin@supperclub.test` and the password is `KitchenAdmin27!`. The two hosted classroom editions share this browser's local accounts and recipes when opened on the same origin. The shared final at `/` uses its own account directory and the private administrator configured in Vercel.

## Previously submitted recipes

Recipes saved in the browser-only edition stay in the original browser profile. To share one with the community, sign in to the hosted app and use **Submit a recipe**.

For a short demonstration, sample submission and reviewer questions, see the [review guide](docs/REVIEW.md).
