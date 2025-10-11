from PIL import Image, ImageDraw, ImageFilter
import random, math, json, os

W, H = 1920, 1080
SEED = 424242
random.seed(SEED)

img = Image.new('RGB', (W, H), (8, 9, 10))
draw = ImageDraw.Draw(img)

paths = []
junctions = []

def lerp(a, b, t):
    return a + (b - a) * t

def branch(x, y, ang, length, depth, max_depth, path):
    if depth > max_depth or length < 12:
        if len(path) > 1:
            paths.append(path[:])
        return

    ang += random.uniform(-0.10, 0.10)  # gentle curvature
    x2 = x + math.cos(ang) * length
    y2 = y + math.sin(ang) * length

    t = depth / max_depth
    width = max(1, int(5 * (1 - t)))
    draw.line([(x, y), (x2, y2)], fill=(74, 92, 82), width=width)

    # bulbs more likely at early depths
    if depth <= 2 and random.random() < 0.9 or random.random() < 0.2:
        r = 6 if depth == 0 else random.randint(3, 5)
        draw.ellipse([x2-r, y2-r, x2+r, y2+r], fill=(122, 174, 138))
        junctions.append({"x": x2, "y": y2, "r": r, "depth": depth})

    path.append((x2, y2))

    # forward
    branch(x2, y2, ang + random.uniform(-0.18, 0.18),
           length * lerp(0.72, 0.86, random.random()), depth+1, max_depth, path[:])
    # side
    if random.random() < 0.9 - depth * 0.1:
        side_turn = random.uniform(0.45, 1.0) * (1 if random.random() < 0.5 else -1)
        branch(x2, y2, ang + side_turn,
               length * lerp(0.55, 0.78, random.random()), depth+1, max_depth, path[:])

# hub near lower-right
root_x, root_y = int(W * 0.78), int(H * 0.64)
draw.ellipse([root_x-6, root_y-6, root_x+6, root_y+6], fill=(150, 200, 170))
junctions.append({"x": root_x, "y": root_y, "r": 6, "depth": 0, "root": True})

# canopy fan to left/up-left
for i in range(10):
    base_ang = lerp(math.pi * 0.65, math.pi * 1.15, i / 9.0)
    base_len = lerp(210, 320, random.random())
    branch(root_x, root_y, base_ang + random.uniform(-0.08, 0.08), base_len, 0, 7, [(root_x, root_y)])

# ambient spores
for _ in range(160):
    x = random.randint(0, W-1)
    y = random.randint(0, H-1)
    r = random.randint(1, 2)
    draw.ellipse([x-r, y-r, x+r, y+r], fill=(122, 174, 138))

# Apply subtle blur
img = img.filter(ImageFilter.GaussianBlur(0.15))

# Save outputs
os.makedirs('artifacts', exist_ok=True)
img.save('artifacts/fungi_network_bg.jpg', quality=88)

with open('artifacts/fungi_network_map.json', 'w') as f:
    json.dump({
        "seed": SEED,
        "width": W,
        "height": H,
        "paths": paths,
        "junctions": junctions
    }, f)

print(f'✓ regenerated fungi bg + map')
print(f'✓ Generated {len(paths)} paths and {len(junctions)} junctions')
