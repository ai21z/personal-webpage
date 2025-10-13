import json

# Load the network data
with open('artifacts/network.json', 'r') as f:
    data = json.load(f)

junctions = data['junctions']
print(f"Total junctions: {len(junctions)}")

# Target areas based on the red dots in the image
targets = [
    ("intro (top-right)", 1630, 120, 50),
    ("about (upper-middle)", 1440, 135, 50),
    ("projects (middle)", 880, 210, 50),
    ("blog (lower)", 500, 330, 50)
]

for name, target_x, target_y, radius in targets:
    print(f"\n{name} - Looking near x={target_x}, y={target_y}:")
    candidates = []
    for j in junctions:
        dist = ((j['x'] - target_x)**2 + (j['y'] - target_y)**2)**0.5
        if dist < radius:
            candidates.append((dist, j))
    
    candidates.sort()
    if candidates:
        print(f"  Found {len(candidates)} junctions within {radius}px:")
        for dist, j in candidates[:5]:
            print(f"    Distance: {dist:.1f}px -> x={j['x']:.1f}, y={j['y']:.1f}")
    else:
        print(f"  No junctions found within {radius}px")
