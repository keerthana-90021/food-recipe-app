import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// The reviewed editorial file is also a classic script in the teaching edition.
// Read only that bundled file. No submitted or remote script is evaluated.
const scope = {window:{}};
runInNewContext(readFileSync(new URL('../public/shared/recipes.js',import.meta.url),'utf8'),scope);
export const seeds = JSON.parse(JSON.stringify(scope.window.KitchenSeeds)).map(recipe => ({
  ...recipe,authorId:'kitchen',status:'approved',revision:0
}));
export const seedById = new Map(seeds.map(recipe => [recipe.id,recipe]));
export const seedImages = new Set(seeds.map(recipe => recipe.image).filter(Boolean));
