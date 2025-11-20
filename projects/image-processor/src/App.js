import React, { useState } from 'react';
import { canvasRGBA } from 'stackblur-canvas';
import './App.css';

function App() {
  const [imageUrl, setImageUrl] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [color, setColor] = useState(null);
  const [blurredImageUrl, setBlurredImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generatingGradient, setGeneratingGradient] = useState(false);

  const rgbToHsv = (r, g, b) => {
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

  const extractColor = (imageFile) => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(imageFile);
      
      img.onload = () => {
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

        URL.revokeObjectURL(url);
        resolve(mostSaturated);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };

      img.src = url;
    });
  };

  const createBlurredImage = (imageFile) => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(imageFile);
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw the image
        ctx.drawImage(img, 0, 0);
        
        // Apply heavy blur using StackBlur (simulating Figma's 500px blur)
        // Using a very high radius for heavy blur effect
        canvasRGBA(canvas, 0, 0, canvas.width, canvas.height, 200);
        
        // Convert canvas to blob URL
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          if (blob) {
            const blurredUrl = URL.createObjectURL(blob);
            resolve(blurredUrl);
          } else {
            resolve(null);
          }
        }, 'image/png');
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };

      img.src = url;
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;

    setLoading(true);
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImageUrl(url);

    const extractedColor = await extractColor(file);
    setColor(extractedColor);
    setBlurredImageUrl(null);
    setLoading(false);
  };

  const handleGenerateGradient = async () => {
    if (!imageFile) return;
    
    setGeneratingGradient(true);
    const blurredUrl = await createBlurredImage(imageFile);
    setBlurredImageUrl(blurredUrl);
    setGeneratingGradient(false);
  };

  return (
    <div className="App">
      <input
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        id="image-upload"
        style={{ display: 'none' }}
      />
      <label htmlFor="image-upload" className="upload-button">
        Upload Image
      </label>

      {imageUrl && (
        <div className="image-preview">
          <img src={imageUrl} alt="Uploaded" />
        </div>
      )}

      {loading && <div className="loading">Loading...</div>}

      {color && !loading && (
        <div className="color-result">
          <div className="color-swatch" style={{ backgroundColor: color.hex }}></div>
          <div className="color-hex">{color.hex}</div>
        </div>
      )}

      {imageUrl && !loading && (
        <button 
          onClick={handleGenerateGradient} 
          className="gradient-button"
          disabled={generatingGradient}
        >
          {generatingGradient ? 'Generating...' : 'Create Blurred Gradient'}
        </button>
      )}

      {generatingGradient && <div className="loading">Creating blurred image...</div>}

      {blurredImageUrl && !generatingGradient && (
        <div className="blurred-result">
          <img src={blurredImageUrl} alt="Blurred" className="blurred-image" />
        </div>
      )}
    </div>
  );
}

export default App;

