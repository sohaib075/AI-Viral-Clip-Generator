import os
from PIL import Image

def resize_image(input_path, output_path, size, pad=False):
    print(f"Generating {output_path} ({size}x{size})")
    img = Image.open(input_path)
    
    # Resize keeping aspect ratio
    img.thumbnail((size, size), Image.Resampling.LANCZOS)
    
    if pad:
        # Create a transparent background and paste the image in the center
        new_img = Image.new("RGBA", (size, size), (255, 255, 255, 0))
        new_img.paste(img, ((size - img.size[0]) // 2, (size - img.size[1]) // 2))
        new_img.save(output_path)
    else:
        img.save(output_path)

if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    src_logo = os.path.join(script_dir, "..", "..", "frontend", "public", "logo.png")
    out_dir = os.path.join(script_dir, "..", "assets", "images")
    
    # 1. Main App Icon
    resize_image(src_logo, os.path.join(out_dir, "icon.png"), 1024, pad=True)
    
    # 2. Splash Icon (Centered inside splash)
    resize_image(src_logo, os.path.join(out_dir, "splash-icon.png"), 512, pad=True)
    
    # 3. Android Adaptive Foreground
    resize_image(src_logo, os.path.join(out_dir, "android-icon-foreground.png"), 1024, pad=True)
    
    print("Asset generation complete!")
