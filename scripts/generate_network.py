"""
Necrography-style mycelium network generator
Uses space-colonization algorithm with proper termination guards
"""
from PIL import Image, ImageDraw, ImageFilter
import random, json, math, os

# Configuration
W, H = 1920, 1080
SEED = 4242
random.seed(SEED)

# Dark Horror Palette (matching page)
ABYSS = (25, 28, 30)         # --abyss (slightly lighter for visibility)
NECROTIC = (122, 174, 138)   # --necrotic (main network color)
SPECTRAL = (143, 180, 255)   # --spectral (accent highlights)
FUNGAL = (74, 92, 82)        # --fungal (dim nodes)
EMBER = (194, 74, 46)        # --ember (junction highlights)

# Growth parameters
ROOT = (int(W * 0.85), int(H * 0.85))  # BOTTOM-RIGHT corner root (or use 0.15 for top-right)
NUM_ATTRACTORS = 3500  # More attractors for larger radius
INFLUENCE_RADIUS = 150
KILL_RADIUS = 45
STEP_SIZE = 14
MERGE_THRESHOLD = 10
MAX_GROWTH_RADIUS = int(W * 1.5)  # 150% of screen width

# Termination guards (CRITICAL)
MAX_ITERATIONS = 8000
MAX_NODES = 12000
STALL_LIMIT = 400

# NO directional bias - radial growth in all directions
BIAS_ANGLE = 0
BIAS_STRENGTH = 0.0  # No bias = radial spread

print(f"Starting generation (seed: {SEED})...")
print(f"Termination: max {MAX_ITERATIONS} iters, {MAX_NODES} nodes, stall after {STALL_LIMIT}")

# Helper functions
def normalize(vx, vy):
    """Normalize vector to unit length"""
    length = math.sqrt(vx*vx + vy*vy)
    if length < 1e-9:
        return 0.0, 0.0
    return vx/length, vy/length

def distance_squared(p1, p2):
    """Calculate squared distance between two points"""
    dx = p1[0] - p2[0]
    dy = p1[1] - p2[1]
    return dx*dx + dy*dy

def in_growth_zone(x, y):
    """Check if point is in valid growth wedge"""
    # Boundary check
    margin = 30
    if x < margin or y < margin or x > W-margin or y > H-margin:
        return False
    
    # Don't grow too far right/down from root
    if x > ROOT[0] + 80 and y > ROOT[1] + 80:
        return False
    
    # RADIAL: Allow all directions from center
    return True

# Generate attractors in RADIAL pattern (all directions from corner)
print("Generating attractors...")
attractors = []

for _ in range(NUM_ATTRACTORS):
    # Random radius (150% of screen width) and angle for full 360° coverage
    radius = random.uniform(100, MAX_GROWTH_RADIUS)
    angle = random.uniform(0, 2 * math.pi)
    
    x = int(ROOT[0] + math.cos(angle) * radius)
    y = int(ROOT[1] + math.sin(angle) * radius)
    
    # Allow attractors outside screen bounds (network will grow to fill visible area)
    attractors.append((x, y))

print(f"Created {len(attractors)} attractors")

# Initialize growth tree with ROOT + initial branches
import math as m
nodes = [ROOT]
parent_indices = [-1]
children = [[]]
node_depths = [0]  # Track generation depth for tapering

# Create 8 initial branches from root to seed growth
initial_branches = 8
for i in range(initial_branches):
    angle = BIAS_ANGLE + (i - initial_branches/2) * 0.4
    x = ROOT[0] + m.cos(angle) * STEP_SIZE * 2
    y = ROOT[1] + m.sin(angle) * STEP_SIZE * 2
    nodes.append((x, y))
    parent_indices.append(0)
    node_depths.append(1)  # First generation from root
    children.append([])
    children[0].append(len(nodes) - 1)

active_tips = list(range(1, len(nodes)))  # All initial branches are active

# Growth statistics
iteration = 0
stall_counter = 0
prev_attractor_count = len(attractors)

print("Starting space-colonization growth...")

# Main growth loop
while attractors and active_tips and iteration < MAX_ITERATIONS and len(nodes) < MAX_NODES:
    iteration += 1
    
    # Progress report every 100 iterations
    if iteration % 100 == 0:
        print(f"  Iter {iteration}: {len(nodes)} nodes, {len(attractors)} attractors, {len(active_tips)} active tips, {len(new_tips)} new this iter")
    
    # Calculate influence for each active tip
    influences = {tip_idx: [0.0, 0.0] for tip_idx in active_tips}
    
    # Track which attractors to keep
    surviving_attractors = []
    
    # For each attractor, find closest active tip and influence it
    for ax, ay in attractors:
        closest_tip = None
        closest_dist_sq = INFLUENCE_RADIUS * INFLUENCE_RADIUS
        
        for tip_idx in active_tips:
            nx, ny = nodes[tip_idx]
            dist_sq = distance_squared((ax, ay), (nx, ny))
            
            if dist_sq < closest_dist_sq:
                closest_dist_sq = dist_sq
                closest_tip = tip_idx
        
        if closest_tip is not None:
            # Add influence vector
            nx, ny = nodes[closest_tip]
            dx = ax - nx
            dy = ay - ny
            ux, uy = normalize(dx, dy)
            influences[closest_tip][0] += ux
            influences[closest_tip][1] += uy
            
            # Keep attractor if it's still far enough
            kill_threshold = (KILL_RADIUS + STEP_SIZE) * (KILL_RADIUS + STEP_SIZE)
            if closest_dist_sq > kill_threshold:
                surviving_attractors.append((ax, ay))
        else:
            # No active tip in range, keep attractor
            surviving_attractors.append((ax, ay))
    
    attractors = surviving_attractors
    
    # Check for stall
    if len(attractors) >= prev_attractor_count - 2:
        stall_counter += 1
        if stall_counter >= STALL_LIMIT:
            print(f"  Stalled at iteration {iteration} (attractors not decreasing)")
            break
    else:
        stall_counter = 0
    prev_attractor_count = len(attractors)
    
    # Grow new nodes from influenced tips
    new_tips = []
    bias_x = math.cos(BIAS_ANGLE)
    bias_y = math.sin(BIAS_ANGLE)
    
    for tip_idx in active_tips:
        vx, vy = influences[tip_idx]
        magnitude = math.sqrt(vx*vx + vy*vy)
        
        if magnitude < 1e-6:
            continue
        
        # Normalize influence
        vx, vy = vx/magnitude, vy/magnitude
        
        # Apply directional bias
        vx = vx * (1 - BIAS_STRENGTH) + bias_x * BIAS_STRENGTH
        vy = vy * (1 - BIAS_STRENGTH) + bias_y * BIAS_STRENGTH
        vx, vy = normalize(vx, vy)
        
        # Calculate new position
        nx, ny = nodes[tip_idx]
        new_x = nx + vx * STEP_SIZE
        new_y = ny + vy * STEP_SIZE
        
        # Always create new node
        parent_indices.append(tip_idx)
        nodes.append((new_x, new_y))
        node_depths.append(node_depths[tip_idx])  # Same depth as parent (extending branch)
        
        # Update children
        while len(children) <= len(nodes) - 1:
            children.append([])
        children[tip_idx].append(len(nodes) - 1)
        
        new_tips.append(len(nodes) - 1)
        
        # Random branching: sometimes create a second child at an angle
        if random.random() < 0.15 and len(children[tip_idx]) < 3:
            branch_angle = random.uniform(-0.6, 0.6)
            bvx = math.cos(math.atan2(vy, vx) + branch_angle)
            bvy = math.sin(math.atan2(vy, vx) + branch_angle)
            
            branch_x = nx + bvx * STEP_SIZE
            branch_y = ny + bvy * STEP_SIZE
            
            parent_indices.append(tip_idx)
            nodes.append((branch_x, branch_y))
            node_depths.append(node_depths[tip_idx] + 1)  # Child branch is one generation deeper
            
            while len(children) <= len(nodes) - 1:
                children.append([])
            children[tip_idx].append(len(nodes) - 1)
            
            new_tips.append(len(nodes) - 1)
    
    # Update active tips: Find ALL leaf nodes
    # A node is a leaf if it has no children
    leaf_nodes = []
    for idx in range(len(nodes)):
        if idx >= len(children) or not children[idx]:
            leaf_nodes.append(idx)
    
    active_tips = leaf_nodes
    
    # Safety limit
    if len(active_tips) > 300:
        active_tips = active_tips[-300:]

print(f"Growth complete: {len(nodes)} nodes in {iteration} iterations")

# Build polyline paths from tree structure with depth info
print("Building paths...")
paths = []  # Each path: [(x, y, depth), ...]

def build_path(node_idx, path_so_far):
    """Recursively build polyline paths with depth"""
    path_so_far.append((nodes[node_idx][0], nodes[node_idx][1], node_depths[node_idx]))
    
    if len(children[node_idx]) == 1:
        # Single child: continue current path
        build_path(children[node_idx][0], path_so_far)
    else:
        # Multiple children or leaf: save current path and branch
        if len(path_so_far) > 1:
            paths.append(list(path_so_far))
        
        for child_idx in children[node_idx]:
            build_path(child_idx, [(nodes[node_idx][0], nodes[node_idx][1], node_depths[node_idx])])

build_path(0, [])
print(f"Created {len(paths)} paths")

# DEBUG: Print sample path coordinates
if paths:
    print(f"DEBUG - First path has {len(paths[0])} points")
    print(f"DEBUG - First 3 points: {paths[0][:3]}")
    print(f"DEBUG - Last 3 points: {paths[0][-3:]}")
    print(f"DEBUG - Coordinate range X: {min(p[0] for path in paths for p in path):.1f} to {max(p[0] for path in paths for p in path):.1f}")
    print(f"DEBUG - Coordinate range Y: {min(p[1] for path in paths for p in path):.1f} to {max(p[1] for path in paths for p in path):.1f}")

# Smooth paths with Chaikin subdivision (preserve depth) - MORE PASSES for smoother curves
def chaikin_smooth(points, iterations=4):
    """Apply Chaikin curve smoothing while preserving depth - extra smooth for bio-net style"""
    for _ in range(iterations):
        if len(points) < 3:
            break
        
        smoothed = [points[0]]
        for i in range(len(points) - 1):
            x0, y0, depth0 = points[i]
            x1, y1, depth1 = points[i + 1]
            
            # Use depth from first point for interpolated points
            depth = depth0
            
            # Quarter point
            q = (x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25, depth)
            smoothed.append(q)
            
            # Three-quarter point  
            r = (x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75, depth)
            smoothed.append(r)
        
        smoothed.append(points[-1])
        points = smoothed
    
    return points

paths = [chaikin_smooth(path, 4) for path in paths if len(path) > 1]
print("Applied Chaikin smoothing")

# Find junctions (branch points with 2+ children for better detection)
junctions = []
child_counts = {}
for idx, child_list in enumerate(children):
    count = len(child_list)
    child_counts[count] = child_counts.get(count, 0) + 1
    
    if count >= 2:  # Lowered from 3+ to 2+ for better junction detection
        x, y = nodes[idx]
        dist_from_root = math.sqrt((x - ROOT[0])**2 + (y - ROOT[1])**2)
        radius = min(10, 3 + count)
        junctions.append({
            "x": x,
            "y": y,
            "r": radius,
            "depth": dist_from_root
        })

print(f"Found {len(junctions)} junctions (nodes with 2+ children)")
print(f"Child count distribution: {dict(sorted(child_counts.items()))}")

# Pick strategic navigation nodes by angle sectors
def pick_by_angle(target_degrees, min_distance=250):
    """Find junction closest to target angle from root"""
    target_rad = math.radians(target_degrees)
    best_junction = None
    best_score = float('inf')
    
    for j in junctions:
        dx = j["x"] - ROOT[0]
        dy = j["y"] - ROOT[1]
        distance = math.sqrt(dx*dx + dy*dy)
        
        if distance < min_distance:
            continue
        
        angle = math.atan2(dy, dx)
        normalized = (angle + 2*math.pi) % (2*math.pi)
        
        # Angular difference
        diff = min(abs(normalized - target_rad), 
                  2*math.pi - abs(normalized - target_rad))
        
        # Score: prefer correct angle + far from root
        score = diff * 1000 - distance
        
        if score < best_score:
            best_score = score
            best_junction = j
    
    return best_junction

# Strategic nodes: VERTICAL placement on LEFT side (top to bottom)
# Find junctions on the left side at different vertical positions

def pick_by_vertical_position(target_y_percent, x_min=50, x_max=W*0.35):
    """Find junction on VISIBLE LEFT side at specific vertical position"""
    target_y = int(H * target_y_percent)
    best_junction = None
    best_score = float('inf')
    
    for j in junctions:
        # Must be VISIBLE on left side (within canvas bounds)
        if j["x"] < x_min or j["x"] > x_max:
            continue
        if j["y"] < 0 or j["y"] > H:
            continue
        
        # Calculate vertical distance from target
        y_diff = abs(j["y"] - target_y)
        
        # Prefer nodes on far left and close to target height
        score = y_diff + (j["x"] * 0.3)  # Slightly penalize being too far right
        
        if score < best_score:
            best_score = score
            best_junction = j
    
    return best_junction

strategic_nodes = {
    "intro": {"x": ROOT[0], "y": ROOT[1]},  # Keep at root
    "about": pick_by_vertical_position(0.25),    # Top (25% down)
    "projects": pick_by_vertical_position(0.50), # Middle (50% down)
    "blog": pick_by_vertical_position(0.75)      # Bottom (75% down)
}

# Fallback to leftmost junctions if vertical picking fails
if strategic_nodes["about"] is None:
    strategic_nodes["about"] = junctions[0] if junctions else {"x": 150, "y": int(H*0.25)}
if strategic_nodes["projects"] is None:
    strategic_nodes["projects"] = junctions[1] if len(junctions) > 1 else {"x": 150, "y": int(H*0.50)}
if strategic_nodes["blog"] is None:
    strategic_nodes["blog"] = junctions[2] if len(junctions) > 2 else {"x": 150, "y": int(H*0.75)}

print("Selected strategic navigation nodes")

# Render base and glow images
print("Rendering images...")

def render_network(is_glow=False):
    """Render the network to an image"""
    img = Image.new("RGB", (W, H), ABYSS)
    draw = ImageDraw.Draw(img, "RGBA")
    
    # VIGNETTE DISABLED - was making image too dark
    # Just use plain background for now
    
    # Draw paths with hierarchical tapering
    for path in paths:
        if len(path) < 2:
            continue
        
        # Get depth of this branch (from first point)
        branch_depth = path[0][2]
        
        # Draw path with segments that taper along length
        path_length = len(path)
        for i in range(len(path) - 1):
            x1, y1, depth1 = path[i]
            x2, y2, depth2 = path[i + 1]
            
            # Progress along this path (0.0 = start, 1.0 = end)
            progress = i / max(1, path_length - 1)
            
            # Base width depends on depth (generation) - REDUCED ~30% for subtlety
            # Depth 0 (root) = 11, depth 1 = 8.5, depth 2 = 6, depth 3+ = 3.5, etc.
            base_width = max(2, 11 - branch_depth * 2.5)
            
            # Gentle taper along length: start at base_width, end at 60% of base_width
            width = base_width * (1.0 - progress * 0.4)
            width = max(1.5, width)
            
            if is_glow:
                width = width + 1.5
                color = SPECTRAL + (180,)  # Spectral blue glow
            else:
                color = NECROTIC + (255,)  # Necrotic green veins
            
            # Draw segment
            draw.line([(x1, y1), (x2, y2)], fill=color, width=int(width), joint='curve')
    
    # Draw GLOWING NODES at junctions - smaller and scale with distance from center
    if not is_glow:
        # Calculate center of canvas for distance scaling
        center_x, center_y = W / 2, H / 2
        max_distance = math.sqrt((W/2)**2 + (H/2)**2)  # Max distance from center to corner
        
        for j in junctions:
            x, y = j["x"], j["y"]
            depth = j.get("depth", 0)
            
            # Calculate distance from center (normalized 0-1)
            dist_from_center = math.sqrt((x - center_x)**2 + (y - center_y)**2)
            dist_factor = dist_from_center / max_distance  # 0 at center, 1 at corners
            
            # Base size starts smaller (5-7px) and shrinks with distance
            # Near center: 6-7px, far edges: 2-3px
            base_size = max(2, int(7 - dist_factor * 4))  # Shrinks by up to 4px
            base_size += random.randint(-1, 0)  # Slight downward variation
            
            # Even smaller glow layers
            for i in range(2, 0, -1):  # Only 2 layers now
                r = base_size + i * 2  # Tighter glow
                alpha = 20 + (2 - i) * 15  # Dimmer
                draw.ellipse([x-r, y-r, x+r, y+r], 
                           fill=NECROTIC + (alpha,))
            
            # Bright core (NO EMBER CENTER - removed red dots)
            r_core = base_size
            draw.ellipse([x-r_core, y-r_core, x+r_core, y+r_core], 
                       fill=NECROTIC + (180,))  # Dimmer core
    
    return img

base_img = render_network(is_glow=False)
glow_img = render_network(is_glow=True)

# Save outputs
os.makedirs("artifacts", exist_ok=True)

base_img.save("artifacts/bg_base.png", quality=92)
glow_img.save("artifacts/bg_glow.png", quality=92)

# Save network data
network_data = {
    "width": W,
    "height": H,
    "seed": SEED,
    "root": {"x": ROOT[0], "y": ROOT[1]},
    "paths": [[(p[0], p[1]) for p in path] for path in paths],
    "junctions": junctions,
    "strategic": strategic_nodes
}

with open("artifacts/network.json", "w") as f:
    json.dump(network_data, f, indent=2)

print("✅ Complete!")
print(f"   bg_base.png: {len(paths)} paths")
print(f"   bg_glow.png: glow overlay")
print(f"   network.json: {len(junctions)} junctions")
print(f"   Strategic nodes: intro, about, projects, blog")
