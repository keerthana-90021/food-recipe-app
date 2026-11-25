/* Shared recipe image processing for the React and plain JavaScript editions. */
(() => {
  'use strict';
  const maxInputBytes = 10 * 1024 * 1024;
  const maxOutputBytes = 180 * 1024;
  const encodedLimit = Math.ceil(maxOutputBytes / 3) * 4;
  const jpegPrefix = 'data:image/jpeg;base64,';

  function validPhoto(value) {
    if (typeof value !== 'string' || value.length > jpegPrefix.length + encodedLimit || !value.startsWith(jpegPrefix + '/9j/')) return false;
    const payload = value.slice(jpegPrefix.length);
    if (payload.length < 16 || payload.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) return false;
    return atob(payload.slice(-8)).endsWith('\xff\xd9');
  }

  function source(recipe, imageDirectory = './images/') {
    if (!recipe) return '';
    if (recipe.photo && validPhoto(recipe.photo)) return recipe.photo;
    const file = recipe.image;
    if (typeof file !== 'string' || !file) return '';
    if (file.startsWith('/api/kitchen?')) {
      const params = new URLSearchParams(file.slice(file.indexOf('?') + 1));
      return params.get('image') ? file : '';
    }
    return /^[a-z0-9][a-z0-9._-]*\.(?:jpg|jpeg|png|webp)$/i.test(file)
      ? window.SupperclubPhotos?.[file] || imageDirectory + encodeURIComponent(file) : '';
  }

  // Read the dimensions from the compressed file before asking the browser to decode its pixels.
  function metadata(buffer) {
    const data = new Uint8Array(buffer);
    const view = new DataView(buffer);
    const u16 = n => view.getUint16(n);
    const u32 = n => view.getUint32(n);
    const tag = n => String.fromCharCode(...data.subarray(n,n+4));
    if (data.length >= 33 && u32(0) === 0x89504e47 && u32(4) === 0x0d0a1a0a && tag(12) === 'IHDR') {
      return ['image/png', u32(16), u32(20)];
    }
    if (data.length >= 30 && tag(0) === 'RIFF' && tag(8) === 'WEBP') {
      const chunk = tag(12);
      if (chunk === 'VP8X') {
        const u24le = n => data[n] + data[n+1] * 256 + data[n+2] * 65536;
        return ['image/webp', u24le(24) + 1, u24le(27) + 1];
      }
      if (chunk === 'VP8 ' && data[23] === 0x9d && data[24] === 1 && data[25] === 0x2a) {
        return ['image/webp', view.getUint16(26,true) & 0x3fff, view.getUint16(28,true) & 0x3fff];
      }
      if (chunk === 'VP8L' && data[20] === 0x2f) {
        const bits = view.getUint32(21,true);
        return ['image/webp', (bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
      }
    }
    if (data.length > 4 && u16(0) === 0xffd8) {
      let pos = 2;
      while (pos + 3 < data.length && data[pos] === 0xff) {
        while (pos < data.length && data[pos] === 0xff) pos++;
        const marker = data[pos++];
        if (marker === 0xda || marker === 0xd9) break;
        if (marker === 1 || (marker >= 0xd0 && marker <= 0xd7)) continue;
        if (pos+2 > data.length) break;
        const len = u16(pos);
        if (len < 2 || pos+len > data.length) break;
        if (len >= 8 && [0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
          return ['image/jpeg', u16(pos+5), u16(pos+3)];
        }
        pos += len;
      }
    }
    throw new Error('Choose a JPEG, PNG or WebP image that your browser can open.');
  }

  async function read(file) {
    if (!file?.size || file.size > maxInputBytes) throw new Error('Choose a photo under 10 MB.');
    const [type,width,height] = metadata(await file.arrayBuffer());
    if (!width || !height || width * height > 40000000 || Math.max(width,height) > 16000) {
      throw new Error('Choose a photo under 40 megapixels and 16,000 pixels on either side.');
    }
    const objectUrl = URL.createObjectURL(file.slice(0,file.size,type));
    try {
      const image = new Image();
      image.src = objectUrl;
      try { await image.decode(); } catch { throw new Error('This photo could not be opened. Try another image.'); }
      // HTMLImageElement includes camera orientation. A fresh canvas drops the original EXIF metadata.
      const canvas = document.createElement('canvas');
      const sourceWidth = image.naturalWidth, sourceHeight = image.naturalHeight;
      if (!sourceWidth || !sourceHeight || sourceWidth*sourceHeight > 40000000 || Math.max(sourceWidth,sourceHeight) > 16000) {
        throw new Error('Choose a photo under 40 megapixels and 16,000 pixels on either side.');
      }
      for (const longest of [960,720,540,405]) {
        const scale = Math.min(1, longest/Math.max(sourceWidth,sourceHeight));
        canvas.width = Math.max(1,Math.round(sourceWidth*scale));
        canvas.height = Math.max(1,Math.round(sourceHeight*scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Your browser could not prepare the photo.');
        ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(image,0,0,canvas.width,canvas.height);
        for (const quality of [.84,.68,.52]) {
          const result = canvas.toDataURL('image/jpeg',quality);
          if (validPhoto(result)) return result;
        }
      }
      throw new Error('This photo is too detailed to save. Choose a smaller crop.');
    } finally { URL.revokeObjectURL(objectUrl); }
  }
  window.KitchenPhoto = Object.freeze({read,source,validPhoto});
})();
