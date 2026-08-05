from PIL import Image, ImageDraw

def remove_background(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    width, height = img.size
    
    # Create a radial mask
    mask = Image.new('L', (width, height), 0)
    draw = ImageDraw.Draw(mask)
    
    # Draw a circle in the center
    # The character is centered, so a circle should work well
    margin = 20
    draw.ellipse([margin, margin, width-margin, height-margin], fill=255)
    
    # Blur the mask slightly for soft edges
    from PIL import ImageFilter
    mask = mask.filter(ImageFilter.GaussianBlur(radius=10))

    img.putalpha(mask)
    img.save(output_path, "PNG")

remove_background("/mnt/user-uploads/image-141.png", "public/assets/shadow-logo-v10.png")
