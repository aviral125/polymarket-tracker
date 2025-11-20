import { canvasRGBA } from 'stackblur-canvas';

/**
 * Convert RGB to HSV color space
 */
export const rgbToHsv = (r, g, b) => {
  r = r / 255;
  g = g / 255;
  b = b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : delta / max;
  const v = max;
  return [h, s, v];
};

/**
 * Extract the most saturated color from an image
 * Works with both File objects and image URLs
 */
export const extractColor = (imageSource) => {
  return new Promise((resolve) => {
    const img = new Image();
    let url;

    // Handle File object or URL string
    if (imageSource instanceof File || imageSource instanceof Blob) {
      url = URL.createObjectURL(imageSource);
    } else {
      url = imageSource;
    }

    // Enable CORS for external URLs
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        let mostSaturated = { rgb: [0, 0, 0], saturation: 0 };

        const sampleRate = Math.max(1, Math.floor((img.width * img.height) / 50000));
        
        for (let i = 0; i < pixels.length; i += 4 * sampleRate) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const [h, s, v] = rgbToHsv(r, g, b);

          if (s > mostSaturated.saturation && v > 0.5) {
            mostSaturated = {
              rgb: [r, g, b],
              saturation: s,
              hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
            };
          }
        }

        if (imageSource instanceof File || imageSource instanceof Blob) {
          URL.revokeObjectURL(url);
        }
        resolve(mostSaturated);
      } catch (error) {
        console.error('Error extracting color:', error);
        if (imageSource instanceof File || imageSource instanceof Blob) {
          URL.revokeObjectURL(url);
        }
        resolve({ rgb: [48, 187, 49], saturation: 0.7, hex: '#30bb31' }); // Fallback to green
      }
    };

    img.onerror = () => {
      console.error('Error loading image for color extraction');
      if (imageSource instanceof File || imageSource instanceof Blob) {
        URL.revokeObjectURL(url);
      }
      resolve({ rgb: [48, 187, 49], saturation: 0.7, hex: '#30bb31' }); // Fallback to green
    };

    img.src = url;
  });
};

/**
 * Create a heavily blurred version of an image (200px blur radius)
 * Works with both File objects and image URLs
 */
export const createBlurredImage = (imageSource) => {
  return new Promise((resolve) => {
    const img = new Image();
    let url;

    // Handle File object or URL string
    if (imageSource instanceof File || imageSource instanceof Blob) {
      url = URL.createObjectURL(imageSource);
    } else {
      url = imageSource;
    }

    // Enable CORS for external URLs
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw the image
        ctx.drawImage(img, 0, 0);
        
        // Apply heavy blur using StackBlur (200px blur radius)
        canvasRGBA(canvas, 0, 0, canvas.width, canvas.height, 200);
        
        // Convert canvas to blob URL
        canvas.toBlob((blob) => {
          if (imageSource instanceof File || imageSource instanceof Blob) {
            URL.revokeObjectURL(url);
          }
          if (blob) {
            const blurredUrl = URL.createObjectURL(blob);
            resolve(blurredUrl);
          } else {
            resolve(null);
          }
        }, 'image/png');
      } catch (error) {
        console.error('Error creating blurred image:', error);
        if (imageSource instanceof File || imageSource instanceof Blob) {
          URL.revokeObjectURL(url);
        }
        resolve(null);
      }
    };

    img.onerror = () => {
      console.error('Error loading image for blur');
      if (imageSource instanceof File || imageSource instanceof Blob) {
        URL.revokeObjectURL(url);
      }
      resolve(null);
    };

    img.src = url;
  });
};

/**
 * Extract dominant color from a CSS gradient string
 * Parses HSL values and returns the first one as hex
 */
export const extractColorFromGradient = (gradientString) => {
  // Parse HSL values from gradient string
  // Example: "linear-gradient(135deg, hsl(120, 85%, 65%), ...)"
  const hslMatch = gradientString.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  
  if (hslMatch) {
    const h = parseInt(hslMatch[1]);
    const s = parseInt(hslMatch[2]);
    const l = parseInt(hslMatch[3]);
    
    // Convert HSL to RGB
    const hslToRgb = (h, s, l) => {
      s /= 100;
      l /= 100;
      const k = n => (n + h / 30) % 12;
      const a = s * Math.min(l, 1 - l);
      const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      return [
        Math.round(255 * f(0)),
        Math.round(255 * f(8)),
        Math.round(255 * f(4))
      ];
    };
    
    const [r, g, b] = hslToRgb(h, s, l);
    return {
      rgb: [r, g, b],
      saturation: s / 100,
      hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    };
  }
  
  // Fallback to green
  return { rgb: [48, 187, 49], saturation: 0.7, hex: '#30bb31' };
};

