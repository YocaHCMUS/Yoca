function hashString(str: string): number {
  let hash = 2166136261; // FNV-1a offset basis
  
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV-1a prime
  }
  
  // Ensure positive 32-bit integer
  return hash >>> 0;
}

function hslToHex(h: number, s: number, l: number): string {
  // Convert h from 0-360 to 0-1
  const hue = h / 360;
  const saturation = s / 100;
  const lightness = l / 100;
  
  let r, g, b;
  
  if (saturation === 0) {
    r = g = b = lightness;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = lightness < 0.5 
      ? lightness * (1 + saturation)
      : lightness + saturation - lightness * saturation;
    const p = 2 * lightness - q;
    
    r = hue2rgb(p, q, hue + 1/3);
    g = hue2rgb(p, q, hue);
    b = hue2rgb(p, q, hue - 1/3);
  }
  
  const toHex = (x: number) => 
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hashColor(key: string): string {
  const hash = hashString(key);
  
  // Golden ratio conjugate for better distribution
  const hue = (hash * 0.618033988749895) % 1 * 360;
  
  // Multiple hash segments for better independence
  const hash1 = (hash >> 16) & 0xFFFF;
  const hash2 = hash & 0xFFFF;
  // Pleasant saturation range: 45-75% (avoiding extremes)
  // Use sine-like distribution for more variety without oversaturation
  const saturation = 45 + (Math.sin(hash1 / 65535 * Math.PI * 2) * 0.3 + 0.5) * 30;
  
  // Optimized lightness range: 45-70% (good for readability on light/dark)
  // Using different hash segment for independence from saturation
  const lightness = 45 + (Math.cos(hash2 / 65535 * Math.PI) * 0.25 + 0.5) * 25;
  
  // Add subtle variation based on string length to reduce collisions
  const lengthMod = (key.length % 11) / 20;
  const finalHue = (hue + lengthMod) % 360;
  
  return hslToHex(finalHue, saturation, lightness);
}

// Optional: Generate a palette of colors from a single key (useful for multi-value visualization)
export function hashColorPalette(key: string, count: number): string[] {
  const baseHash = hashString(key);
  const colors: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const offset = i * 137.508; // Golden angle
    const hue = ((baseHash * 0.618033988749895 + offset) % 1) * 360;
    const saturation = 55 + (Math.sin(baseHash + i) * 0.3 + 0.5) * 20;
    const lightness = 55 + (Math.cos(baseHash * (i + 1)) * 0.3 + 0.5) * 15;
    colors.push(hslToHex(hue, saturation, lightness));
  }
  
  return colors;
}