from PIL import Image, ImageDraw

def remove_background(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    width, height = img.size
    
    # Create a mask for background
    mask = Image.new('L', (width, height), 0)
    
    # Seeds for background (corners)
    seeds = [(0, 0), (width-1, 0), (0, height-1), (width-1, height-1)]
    
    # We use tolerance 2 to be safe
    for seed in seeds:
        ImageDraw.floodfill(mask, seed, 255, thresh=2)

    datas = img.getdata()
    new_data = []
    for i, item in enumerate(datas):
        x = i % width
        y = i // width
        if mask.getpixel((x, y)) == 255:
            new_data.append((0, 0, 0, 0))
        else:
            new_data.append(item)

    img.putdata(new_data)
    img.save(output_path, "PNG")

remove_background("/mnt/user-uploads/image-141.png", "public/assets/shadow-logo-v10.png")
