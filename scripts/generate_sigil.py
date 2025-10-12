"""
Necrography-style fractal sigil generator
Creates occult-scientific recursive patterns with aged, etched aesthetic
"""
from PIL import Image, ImageDraw, ImageFilter
import math
import random
import os

# Configuration
SIZE = 1024  # Square canvas
SEED = 4242
random.seed(SEED)

# Dark Horror Palette (matching your page)
ABYSS = (11, 11, 12)          # --abyss
CHARCOAL = (19, 20, 23)       # --charcoal
NECROTIC = (122, 174, 138)    # --necrotic (necrotic green - main lines)
SPECTRAL = (143, 180, 255)    # --spectral (spectral blue accent)
FUNGAL = (74, 92, 82)         # --fungal (dim grey-green)
EMBER = (194, 74, 46)         # --ember (ember orange highlight)

CENTER = (SIZE // 2, SIZE // 2)

def draw_recursive_circle(draw, cx, cy, radius, depth, max_depth=5, angle_offset=0):
    """Draw recursive circular patterns - sacred geometry style"""
    if depth > max_depth or radius < 3:
        return
    
    # Color based on depth
    if depth == 0:
        color = EMBER  # Center is ember
        width = 3
    elif depth <= 2:
        color = NECROTIC  # Necrotic green main lines
        width = 2
    elif depth == 3:
        color = SPECTRAL  # Spectral blue
        width = 1
    else:
        color = FUNGAL  # Dim fungal grey-green
        width = 1
    
    # Draw main circle
    draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius],
                 outline=color, width=width)
    
    # Recursive subdivisions
    if depth < max_depth:
        # Number of child circles based on depth
        num_children = 6 if depth == 0 else 3
        angle_step = (2 * math.pi) / num_children
        
        for i in range(num_children):
            angle = angle_offset + i * angle_step
            # Child circles at 0.6 radius distance
            child_x = cx + math.cos(angle) * radius * 0.6
            child_y = cy + math.sin(angle) * radius * 0.6
            child_radius = radius * 0.38
            
            draw_recursive_circle(draw, child_x, child_y, child_radius, 
                                depth + 1, max_depth, angle + math.pi/6)

def draw_recursive_triangle(draw, cx, cy, size, depth, max_depth=4, rotation=0):
    """Draw recursive triangular Sierpinski-style patterns"""
    if depth > max_depth or size < 8:
        return
    
    # Color based on depth
    if depth == 0:
        color = EMBER
        width = 3
    elif depth <= 2:
        color = NECROTIC
        width = 2
    else:
        color = SPECTRAL
        width = 1
    
    # Calculate triangle points
    points = []
    for i in range(3):
        angle = rotation + (i * 2 * math.pi / 3) - math.pi / 2
        x = cx + math.cos(angle) * size
        y = cy + math.sin(angle) * size
        points.append((x, y))
    
    # Draw triangle
    points.append(points[0])  # Close the shape
    draw.line(points, fill=color, width=width, joint='miter')
    
    # Recursively draw smaller triangles at midpoints
    if depth < max_depth:
        for i in range(3):
            mid_x = (points[i][0] + points[(i+1)%3][0]) / 2
            mid_y = (points[i][1] + points[(i+1)%3][1]) / 2
            draw_recursive_triangle(draw, mid_x, mid_y, size * 0.5, 
                                  depth + 1, max_depth, rotation)

def draw_recursive_hexagon(draw, cx, cy, size, depth, max_depth=4, rotation=0):
    """Draw recursive hexagonal patterns - occult geometry"""
    if depth > max_depth or size < 5:
        return
    
    # Color based on depth
    if depth == 0:
        color = EMBER
        width = 3
    elif depth == 1:
        color = NECROTIC
        width = 2
    elif depth == 2:
        color = SPECTRAL
        width = 2
    else:
        color = FUNGAL
        width = 1
    
    # Calculate hexagon points
    points = []
    for i in range(6):
        angle = rotation + (i * math.pi / 3)
        x = cx + math.cos(angle) * size
        y = cy + math.sin(angle) * size
        points.append((x, y))
    
    # Draw hexagon
    points.append(points[0])  # Close
    draw.line(points, fill=color, width=width, joint='miter')
    
    # Draw inner lines connecting opposite vertices (creates star)
    if depth <= 1:
        for i in range(3):
            draw.line([points[i], points[i+3]], fill=color, width=width)
    
    # Recursive hexagons at vertices
    if depth < max_depth:
        for i in range(6):
            draw_recursive_hexagon(draw, points[i][0], points[i][1], 
                                 size * 0.35, depth + 1, max_depth, rotation + math.pi/12)

def draw_recursive_squares(draw, cx, cy, size, depth, max_depth=5, rotation=0):
    """Draw recursive square patterns - grid-true aesthetic"""
    if depth > max_depth or size < 4:
        return
    
    # Color based on depth
    if depth == 0:
        color = EMBER
        width = 3
    elif depth <= 2:
        color = NECROTIC
        width = 2
    else:
        color = SPECTRAL
        width = 1
    
    # Calculate rotated square points
    points = []
    for i in range(4):
        angle = rotation + (i * math.pi / 2) + math.pi / 4
        x = cx + math.cos(angle) * size
        y = cy + math.sin(angle) * size
        points.append((x, y))
    
    # Draw square
    points.append(points[0])
    draw.line(points, fill=color, width=width, joint='miter')
    
    # Diagonal cross through center
    if depth <= 2:
        draw.line([points[0], points[2]], fill=color, width=width)
        draw.line([points[1], points[3]], fill=color, width=width)
    
    # Recursive squares at corners
    if depth < max_depth:
        for i in range(4):
            draw_recursive_squares(draw, points[i][0], points[i][1],
                                 size * 0.45, depth + 1, max_depth, rotation + math.pi/8)

def draw_spiral_recursion(draw, cx, cy, radius, segments=12, decay=0.85):
    """Draw a recursive spiral - feels like runes being etched"""
    angle = 0
    r = radius
    prev_x, prev_y = cx + r, cy
    
    for i in range(segments):
        # Color transitions through palette
        if i < 3:
            color = EMBER
            width = 3
        elif i < 6:
            color = NECROTIC
            width = 2
        elif i < 9:
            color = SPECTRAL
            width = 2
        else:
            color = FUNGAL
            width = 1
        
        angle += math.pi / 4
        r *= decay
        
        x = cx + r * math.cos(angle)
        y = cy + r * math.sin(angle)
        
        draw.line([(prev_x, prev_y), (x, y)], fill=color, width=width)
        
        # Add small perpendicular marks (rune-like)
        if i % 2 == 0:
            perp_angle = angle + math.pi / 2
            mark_len = r * 0.3
            mark_x1 = x + math.cos(perp_angle) * mark_len
            mark_y1 = y + math.sin(perp_angle) * mark_len
            mark_x2 = x - math.cos(perp_angle) * mark_len
            mark_y2 = y - math.sin(perp_angle) * mark_len
            draw.line([(mark_x1, mark_y1), (mark_x2, mark_y2)], fill=color, width=1)
        
        prev_x, prev_y = x, y
        
        if r < 5:
            break

def generate_sigil(pattern_type="hexagon"):
    """Generate a fractal sigil with necrography aesthetic"""
    # Create base image
    img = Image.new("RGBA", (SIZE, SIZE), ABYSS + (255,))
    draw = ImageDraw.Draw(img, "RGBA")
    
    # Add subtle aged texture background
    texture = Image.new("L", (SIZE, SIZE), 0)
    texture_draw = ImageDraw.Draw(texture)
    for _ in range(2000):
        x = random.randint(0, SIZE)
        y = random.randint(0, SIZE)
        brightness = random.randint(0, 15)
        texture_draw.point((x, y), fill=brightness)
    texture = texture.filter(ImageFilter.GaussianBlur(1.5))
    
    # Composite texture onto base
    texture_overlay = Image.new("RGB", (SIZE, SIZE), CHARCOAL)
    img_rgb = Image.composite(texture_overlay, Image.new("RGB", (SIZE, SIZE), ABYSS), texture)
    img = Image.new("RGBA", (SIZE, SIZE), ABYSS + (255,))
    img.paste(img_rgb, (0, 0))
    draw = ImageDraw.Draw(img, "RGBA")
    
    # Draw the fractal pattern
    if pattern_type == "circles":
        draw_recursive_circle(draw, CENTER[0], CENTER[1], SIZE * 0.38, 0, max_depth=5)
    elif pattern_type == "triangles":
        draw_recursive_triangle(draw, CENTER[0], CENTER[1], SIZE * 0.35, 0, max_depth=4)
    elif pattern_type == "hexagon":
        draw_recursive_hexagon(draw, CENTER[0], CENTER[1], SIZE * 0.35, 0, max_depth=4)
        # Add secondary smaller hexagon
        draw_recursive_hexagon(draw, CENTER[0], CENTER[1], SIZE * 0.18, 0, max_depth=3, rotation=math.pi/6)
    elif pattern_type == "squares":
        draw_recursive_squares(draw, CENTER[0], CENTER[1], SIZE * 0.35, 0, max_depth=5)
    elif pattern_type == "spiral":
        # Multiple spirals from center
        for i in range(8):
            angle = i * math.pi / 4
            offset_x = CENTER[0] + math.cos(angle) * SIZE * 0.05
            offset_y = CENTER[1] + math.sin(angle) * SIZE * 0.05
            draw_spiral_recursion(draw, offset_x, offset_y, SIZE * 0.38, segments=16)
    
    # Add central accent dot
    r = 4
    draw.ellipse([CENTER[0]-r, CENTER[1]-r, CENTER[0]+r, CENTER[1]+r], 
                 fill=EMBER)
    
    # Add edge vignette
    vignette = Image.new("L", (SIZE, SIZE), 0)
    vignette_draw = ImageDraw.Draw(vignette)
    vignette_draw.ellipse([
        -int(SIZE*0.2), -int(SIZE*0.2),
        int(SIZE*1.2), int(SIZE*1.2)
    ], fill=255)
    vignette = vignette.filter(ImageFilter.GaussianBlur(SIZE//8))
    
    # Apply vignette
    dark_frame = Image.new("RGBA", (SIZE, SIZE), ABYSS + (255,))
    img = Image.composite(img, dark_frame, vignette)
    
    # Add subtle grain
    grain = Image.new("L", (SIZE, SIZE), 128)
    grain_draw = ImageDraw.Draw(grain)
    for _ in range(SIZE * SIZE // 8):
        x = random.randint(0, SIZE-1)
        y = random.randint(0, SIZE-1)
        brightness = random.randint(120, 136)
        grain_draw.point((x, y), fill=brightness)
    
    grain = grain.filter(ImageFilter.GaussianBlur(0.5))
    img = Image.blend(img.convert("RGB"), 
                     Image.new("RGB", (SIZE, SIZE), ABYSS),
                     0.03)
    img = img.convert("RGBA")
    
    return img

# Generate all pattern types
os.makedirs("artifacts/sigil/generated", exist_ok=True)

patterns = {
    "circles": "Recursive sacred circles",
    "triangles": "Sierpinski triangular recursion", 
    "hexagon": "Nested hexagonal occult geometry",
    "squares": "Grid-true recursive squares",
    "spiral": "Etched spiral with rune marks"
}

print("Generating necrography fractal sigils...\n")

for pattern_name, description in patterns.items():
    print(f"Creating {pattern_name}... ({description})")
    sigil = generate_sigil(pattern_name)
    
    # Save full size
    filename = f"artifacts/sigil/generated/sigil_{pattern_name}.png"
    sigil.save(filename, quality=95)
    print(f"  ✅ Saved: {filename}")
    
    # Save smaller version for web (512x512)
    sigil_small = sigil.resize((512, 512), Image.Resampling.LANCZOS)
    filename_small = f"artifacts/sigil/generated/sigil_{pattern_name}_512.png"
    sigil_small.save(filename_small, quality=92)
    print(f"  ✅ Saved: {filename_small}\n")

print("=" * 60)
print("✅ COMPLETE!")
print(f"Generated {len(patterns)} fractal sigil variations")
print("\nView them in: artifacts/sigil/generated/")
print("\nPatterns created:")
for name, desc in patterns.items():
    print(f"  • {name}: {desc}")
