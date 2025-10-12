"""
Quick diagnostic: visualize the network structure
"""
import json

with open("artifacts/network.json") as f:
    data = json.load(f)

print("=" * 60)
print("NETWORK DIAGNOSTIC")
print("=" * 60)
print(f"Seed: {data['seed']}")
print(f"Canvas: {data['width']} x {data['height']}")
print(f"Root: ({data['root']['x']}, {data['root']['y']})")
print()
print(f"Total paths: {len(data['paths'])}")
print(f"Total junctions: {len(data['junctions'])}")
print()

# Check path distribution
path_lengths = [len(path) for path in data['paths']]
print("Path lengths:")
print(f"  Min: {min(path_lengths)}")
print(f"  Max: {max(path_lengths)}")
print(f"  Avg: {sum(path_lengths) / len(path_lengths):.1f}")
print()

# Check strategic nodes
print("Strategic nodes:")
for key, node in data['strategic'].items():
    print(f"  {key:10s}: ({node['x']:4.0f}, {node['y']:4.0f})")
    if key != 'intro':
        # Calculate distance from root
        dx = node['x'] - data['root']['x']
        dy = node['y'] - data['root']['y']
        dist = (dx**2 + dy**2)**0.5
        print(f"             Distance from root: {dist:.1f}px")
print()

# Check coverage
all_points = []
for path in data['paths']:
    all_points.extend(path)

if all_points:
    xs = [p[0] for p in all_points]
    ys = [p[1] for p in all_points]
    print("Network bounds:")
    print(f"  X: {min(xs):.0f} to {max(xs):.0f} (width: {max(xs)-min(xs):.0f})")
    print(f"  Y: {min(ys):.0f} to {max(ys):.0f} (height: {max(ys)-min(ys):.0f})")
    print()
    
    # Calculate centroid
    cx = sum(xs) / len(xs)
    cy = sum(ys) / len(ys)
    print(f"Network centroid: ({cx:.0f}, {cy:.0f})")
    print()

# Recommendations
print("=" * 60)
print("ASSESSMENT")
print("=" * 60)

if len(data['junctions']) < 4:
    print("⚠️  Too few junctions for navigation!")
    print("   Need at least 4 distinct branch points")
    print()
    print("FIXES:")
    print("  1. Increase NUM_ATTRACTORS (try 2000-2500)")
    print("  2. Decrease STEP_SIZE (try 12-14 for more nodes)")
    print("  3. Increase INFLUENCE_RADIUS (try 140-160)")
    print("  4. Decrease MERGE_THRESHOLD (try 8-10)")

if max(xs) - min(xs) < 600:
    print("⚠️  Network too narrow!")
    print("   Not spreading enough horizontally")
    print()
    print("FIXES:")
    print("  1. Increase NUM_ATTRACTORS")
    print("  2. Widen growth zone in in_growth_zone()")

same_as_root = sum(1 for k, v in data['strategic'].items() 
                   if k != 'intro' and v['x'] == data['root']['x'] and v['y'] == data['root']['y'])
if same_as_root > 0:
    print(f"⚠️  {same_as_root} strategic nodes are stuck at root!")
    print("   Junction detection failed - need more branching")

print("=" * 60)
