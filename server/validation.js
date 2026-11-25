import { seedImages } from './catalog.js';

export class KitchenError extends Error {
  constructor(status,message,code) { super(message); this.status = status; this.code=code; }
}
export function fail(status,message,code) { throw new KitchenError(status,message,code); }
export function text(value,label,max,required = true) {
  const result = typeof value === 'string' ? value.trim() : '';
  if ((!result && required) || result.length > max) fail(400,'Enter ' + label + ' within ' + max + ' characters.');
  return result;
}
export function emailAddress(value) {
  const email = text(value,'an email address',254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400,'Enter a valid email address.');
  return email;
}
export function passphrase(value,registering) {
  if (typeof value !== 'string' || !value.trim() || value.length > 128 || (registering && [...value].length < 15)) {
    fail(400,registering ? 'Use a passphrase with 15 to 128 characters.' : 'Enter your email and password.');
  }
  return value;
}
export function integer(value,label,max) {
  if ((typeof value !== 'number' && typeof value !== 'string') || !Number.isInteger(Number(value)) || Number(value)<1 || Number(value)>max) {
    fail(400,'Enter ' + label + ' as a whole number from 1 to ' + max + '.');
  }
  return Number(value);
}
function lines(value,label,count,max,min=1) {
  const source = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/\r?\n/) : [];
  const list = source.map(item => text(item,label,max,false)).filter(Boolean);
  if (list.length < min || list.length > count) fail(400,'Provide ' + min + ' to ' + count + ' entries for ' + label + '.');
  return list;
}
const diets = ['Vegetarian','Vegan','Non-vegetarian','Contains egg','Gluten-free','Dairy-free'];
const fold = value => value.toLowerCase().replace(/[\s_-]+/g,'');
export function fields(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(400,'Enter the recipe details.');
  const diet = [...new Set(lines(input.diet,'dietary labels',8,40,0).map(value => diets.find(item => fold(item)===fold(value)) || value))];
  if ((diet.includes('Non-vegetarian') && (diet.includes('Vegetarian') || diet.includes('Vegan'))) ||
    (diet.includes('Contains egg') && diet.includes('Vegan'))) fail(400,'Review the incompatible dietary labels.');
  const values = {
    title:text(input.title,'a recipe title',100), description:text(input.description,'a description',600,false),
    cuisine:text(input.cuisine,'a cuisine',60), diet,
    time:integer(input.time,'cooking time',1440), servings:integer(input.servings,'servings',50),
    ingredients:lines(input.ingredients,'ingredients',50,200),steps:lines(input.steps,'preparation steps',30,600)
  };
  for (const prop of ['category','protein']) if (Object.hasOwn(input,prop)) values[prop]=text(input[prop],prop,60,false);
  return values;
}
const imageLimit = 320 * 1024;
function dimensions(bytes,type) {
  if(type==='png') return [bytes.readUInt32BE(16),bytes.readUInt32BE(20)];
  if(type==='webp') {
    const chunk=bytes.toString('ascii',12,16);
    if(chunk==='VP8X' && bytes.length>=30) return [1+bytes.readUIntLE(24,3),1+bytes.readUIntLE(27,3)];
    if(chunk==='VP8 ' && bytes.length>=30 && bytes.readUIntBE(23,3)===0x9d012a) return [bytes.readUInt16LE(26)&0x3fff,bytes.readUInt16LE(28)&0x3fff];
    if(chunk==='VP8L' && bytes.length>=25 && bytes[20]===0x2f) {
      const size=bytes.readUInt32LE(21);
      return [1+(size&0x3fff),1+((size>>>14)&0x3fff)];
    }
    return [];
  }
  for(let offset=2;offset+4<bytes.length;) {
    if(bytes[offset++]!==0xff) return [];
    while(bytes[offset]===0xff) offset++;
    if(offset+3>bytes.length) return [];
    const marker=bytes[offset++];
    if(marker===0xda || marker===0xd9) return [];
    const length=bytes.readUInt16BE(offset);
    if(length<2 || offset+length>bytes.length) return [];
    if(marker>=0xc0 && marker<=0xcf && ![0xc4,0xc8,0xcc].includes(marker) && length>=8) {
      return [bytes.readUInt16BE(offset+5),bytes.readUInt16BE(offset+3)];
    }
    offset+=length;
  }
  return [];
}
export function photoData(value) {
  if (typeof value !== 'string' || value.length > Math.ceil(imageLimit/3)*4+30) fail(400,'Choose a photo within 320 KiB.');
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) fail(400,'Choose a JPEG, PNG, or WebP photo.');
  const bytes = Buffer.from(match[2],'base64');
  if (!bytes.length || bytes.length > imageLimit || bytes.toString('base64') !== match[2]) fail(400,'Choose a valid photo within 320 KiB.');
  const type = match[1];
  const valid = type === 'jpeg' ? bytes.length >= 12 && bytes.readUIntBE(0,3) === 0xffd8ff && bytes.readUInt16BE(bytes.length-2) === 0xffd9 :
    type === 'png' ? bytes.length >= 33 && bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')) && bytes.toString('ascii',12,16)==='IHDR' :
    bytes.length >= 20 && bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP';
  if (!valid) fail(400,'The uploaded file could not be read as a recipe photo.');
  const size=dimensions(bytes,type);
  if(size.length!==2 || !size.every(n=>n>0 && n<=1600)) fail(400,'Resize the recipe photo to 1,600 pixels per side or smaller.');
  return value;
}
export function imageUrl(recipe) {
  return recipe.photoKey ? '/api/kitchen?image=' + encodeURIComponent(recipe.id) + '&v=' + recipe.revision : recipe.image || '';
}
export function setPhoto(recipe,input,change) {
  const value = Object.hasOwn(input,'photo') ? input.photo : input.image;
  if (value === undefined || value === imageUrl(recipe)) return;
  if (recipe.photoKey) change.remove.push(recipe.photoKey);
  delete recipe.photoKey;
  if (value === '' || seedImages.has(value)) { recipe.image=value; return; }
  const data=photoData(value);
  recipe.photoKey=recipe.id + '/' + recipe.revision;
  recipe.image='';
  change.put={key:recipe.photoKey,data};
}
