"""
Extract highly saturated colors from an image.

This script loads an image, analyzes all pixels, and finds the most saturated colors.
It uses HSV color space where saturation is easily measurable (0-100%).
"""

from PIL import Image
import colorsys
import sys
from collections import Counter


def rgb_to_hsv(r, g, b):
    """Convert RGB (0-255) to HSV (0-1, 0-1, 0-1)."""
    r, g, b = r / 255.0, g / 255.0, b / 255.0
    return colorsys.rgb_to_hsv(r, g, b)


def extract_saturated_colors(image_path, top_n=5, min_saturation=0.5):
    """
    Extract the most saturated colors from an image.
    
    Args:
        image_path: Path to the image file
        top_n: Number of top saturated colors to return
        min_saturation: Minimum saturation threshold (0.0 to 1.0)
    
    Returns:
        List of tuples: (RGB tuple, HSV tuple, saturation value)
    """
    # Load image
    try:
        img = Image.open(image_path)
    except FileNotFoundError:
        print(f"Error: Image file '{image_path}' not found.")
        return []
    except Exception as e:
        print(f"Error loading image: {e}")
        return []
    
    # Convert to RGB if needed
    if img.mode != 'RGB':
        img = img.convert('RGB')
    
    # Get pixel data
    pixels = img.getdata()
    
    # Analyze colors and their saturation
    color_saturation_map = {}
    
    for r, g, b in pixels:
        # Convert to HSV
        h, s, v = rgb_to_hsv(r, g, b)
        
        # Only consider colors above minimum saturation
        if s >= min_saturation:
            # Use rounded RGB as key to group similar colors
            rgb_key = (r, g, b)
            
            # Track the highest saturation for this color
            if rgb_key not in color_saturation_map or s > color_saturation_map[rgb_key][1]:
                color_saturation_map[rgb_key] = ((r, g, b), (h, s, v), s)
    
    # Sort by saturation (descending)
    sorted_colors = sorted(color_saturation_map.values(), key=lambda x: x[2], reverse=True)
    
    # Return top N
    return sorted_colors[:top_n]


def print_color_info(colors):
    """Print color information in a readable format."""
    if not colors:
        print("No saturated colors found.")
        return
    
    print("\nMost Saturated Colors Found:")
    print("-" * 60)
    
    for i, (rgb, hsv, saturation) in enumerate(colors, 1):
        r, g, b = rgb
        h, s, v = hsv
        
        # Convert HSV to more readable format
        h_deg = h * 360
        s_percent = s * 100
        v_percent = v * 100
        
        # Hex color code
        hex_color = f"#{r:02x}{g:02x}{b:02x}"
        
        print(f"\n{i}. RGB: ({r}, {g}, {b})")
        print(f"   Hex: {hex_color}")
        print(f"   HSV: H={h_deg:.1f}°, S={s_percent:.1f}%, V={v_percent:.1f}%")
        print(f"   Saturation: {s_percent:.1f}%")


def main():
    """Main function to run the script."""
    if len(sys.argv) < 2:
        print("Usage: python extract_saturated_color.py <image_path> [top_n] [min_saturation]")
        print("\nExample:")
        print("  python extract_saturated_color.py image.jpg")
        print("  python extract_saturated_color.py image.jpg 10 0.6")
        sys.exit(1)
    
    image_path = sys.argv[1]
    top_n = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    min_saturation = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
    
    print(f"Analyzing image: {image_path}")
    print(f"Looking for top {top_n} colors with saturation >= {min_saturation * 100}%")
    
    colors = extract_saturated_colors(image_path, top_n, min_saturation)
    print_color_info(colors)


if __name__ == "__main__":
    main()


