"""
Blender Script: Combine Mixamo Animations with Character Mesh
=============================================================

This script combines a character mesh with Mixamo animation files
and exports a GLB file ready for WAG GAME.

Usage:
1. Open Blender
2. Go to Scripting workspace
3. Open this script
4. Modify the CONFIGURATION section below
5. Run the script (Alt+P or click Run Script)

Requirements:
- Blender 3.0 or later
- Original character GLTF/FBX from Low Poly People pack
- Mixamo animation FBX files (downloaded with "Without Skin" option)
"""

import bpy
import os
import math

# =============================================================================
# CONFIGURATION - Modify these paths for your character
# =============================================================================

# Base directory for assets
BASE_DIR = "/Users/michalsvondr/WAG_GAME/assets/models"

# Character to process (choose one)
CHARACTER = "casual_male_g"

# Paths configuration
CONFIG = {
    "casual_male_g": {
        "mesh_source": f"{BASE_DIR}/lowpoly-people-pack_extracted/scene.gltf",
        "mesh_armature": "Object_98",  # Armature object name in GLTF
        "mesh_object": "Object_101",    # Mesh object name in GLTF
        "animations_dir": f"{BASE_DIR}/mixamo_animations/casual_male_g",
        "output_path": f"{BASE_DIR}/developer-lowpoly.glb",
        "output_name": "Developer_Lowpoly"
    },
    "casual_female_g": {
        "mesh_source": f"{BASE_DIR}/lowpoly-people-pack_extracted/scene.gltf",
        "mesh_armature": "Object_6",
        "mesh_object": "Object_9",
        "animations_dir": f"{BASE_DIR}/mixamo_animations/casual_female_g",
        "output_path": f"{BASE_DIR}/frontend-developer-lowpoly.glb",
        "output_name": "Frontend_Developer_Lowpoly"
    },
    "casual_female_k": {
        "mesh_source": f"{BASE_DIR}/lowpoly-people-pack_extracted/scene.gltf",
        "mesh_armature": "Object_50",
        "mesh_object": "Object_53",
        "animations_dir": f"{BASE_DIR}/mixamo_animations/casual_female_k",
        "output_path": f"{BASE_DIR}/ux-designer-lowpoly.glb",
        "output_name": "UX_Designer_Lowpoly"
    },
    "casual_male_k": {
        "mesh_source": f"{BASE_DIR}/lowpoly-people-pack_extracted/scene.gltf",
        "mesh_armature": "Object_142",
        "mesh_object": "Object_145",
        "animations_dir": f"{BASE_DIR}/mixamo_animations/casual_male_k",
        "output_path": f"{BASE_DIR}/product-owner-lowpoly.glb",
        "output_name": "Product_Owner_Lowpoly"
    },
    "doctor_male": {
        "mesh_source": f"{BASE_DIR}/lowpoly-people-pack_extracted/scene.gltf",
        "mesh_armature": "Object_190",
        "mesh_object": "Object_193",
        "animations_dir": f"{BASE_DIR}/mixamo_animations/doctor_male",
        "output_path": f"{BASE_DIR}/business-analyst-lowpoly.glb",
        "output_name": "Business_Analyst_Lowpoly"
    },
    "elder_female": {
        "mesh_source": f"{BASE_DIR}/lowpoly-people-pack_extracted/scene.gltf",
        "mesh_armature": "Object_243",
        "mesh_object": "Object_246",
        "animations_dir": f"{BASE_DIR}/mixamo_animations/elder_female",
        "output_path": f"{BASE_DIR}/test-manager-lowpoly.glb",
        "output_name": "Test_Manager_Lowpoly"
    },
}

# Animation file names (must match files in animations_dir)
ANIMATION_FILES = {
    "Idle": "idle.fbx",
    "Walk": "walk.fbx",
    "Run": "run.fbx",
    "Flee": "flee.fbx",
}

# =============================================================================
# SCRIPT - Do not modify below unless you know what you're doing
# =============================================================================

def clear_scene():
    """Clear all objects from the scene"""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    # Clear orphan data
    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in bpy.data.armatures:
        if block.users == 0:
            bpy.data.armatures.remove(block)
    for block in bpy.data.actions:
        if block.users == 0:
            bpy.data.actions.remove(block)

def import_character_mesh(config):
    """Import the character mesh from GLTF"""
    print(f"Importing mesh from: {config['mesh_source']}")

    bpy.ops.import_scene.gltf(filepath=config['mesh_source'])

    # Find our specific character
    armature = bpy.data.objects.get(config['mesh_armature'])
    mesh = bpy.data.objects.get(config['mesh_object'])

    if not armature or not mesh:
        raise ValueError(f"Could not find armature '{config['mesh_armature']}' or mesh '{config['mesh_object']}'")

    # Select and duplicate to isolate
    bpy.ops.object.select_all(action='DESELECT')
    armature.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.duplicate()

    new_armature = bpy.context.active_object
    new_mesh = [o for o in bpy.context.selected_objects if o.type == 'MESH'][0]

    # Delete all other objects
    bpy.ops.object.select_all(action='DESELECT')
    for obj in list(bpy.data.objects):
        if obj not in [new_armature, new_mesh]:
            bpy.data.objects.remove(obj, do_unlink=True)

    # Rename
    new_armature.name = f"{config['output_name']}_Armature"
    new_mesh.name = f"{config['output_name']}_Mesh"

    # Fix orientation (model is lying on Y axis from 3ds Max)
    new_armature.rotation_euler[0] = math.radians(90)
    new_armature.scale = (0.01, 0.01, 0.01)  # cm to m

    # Apply transforms
    bpy.ops.object.select_all(action='DESELECT')
    new_armature.select_set(True)
    new_mesh.select_set(True)
    bpy.context.view_layer.objects.active = new_armature
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    return new_armature, new_mesh

def import_mixamo_animation(anim_path, anim_name, target_armature):
    """Import a Mixamo animation FBX and add it to the target armature"""
    if not os.path.exists(anim_path):
        print(f"Warning: Animation file not found: {anim_path}")
        return None

    print(f"Importing animation: {anim_name} from {anim_path}")

    # Import the FBX
    bpy.ops.import_scene.fbx(
        filepath=anim_path,
        use_anim=True,
        ignore_leaf_bones=True,
        automatic_bone_orientation=True,
    )

    # Find the imported armature (should be the only new armature)
    imported_armature = None
    for obj in bpy.context.selected_objects:
        if obj.type == 'ARMATURE' and obj != target_armature:
            imported_armature = obj
            break

    if not imported_armature:
        print(f"Warning: No armature found in animation file: {anim_path}")
        return None

    # Get the animation action
    if imported_armature.animation_data and imported_armature.animation_data.action:
        action = imported_armature.animation_data.action
        action.name = anim_name

        # Copy action to target armature
        if not target_armature.animation_data:
            target_armature.animation_data_create()

        # Create NLA track for this animation
        track = target_armature.animation_data.nla_tracks.new()
        track.name = anim_name
        track.strips.new(anim_name, int(action.frame_range[0]), action)

        print(f"  Added animation: {anim_name} ({int(action.frame_range[1] - action.frame_range[0])} frames)")

    # Delete the imported armature (we only wanted the animation)
    bpy.data.objects.remove(imported_armature, do_unlink=True)

    return action

def export_glb(armature, mesh, output_path):
    """Export the character with animations as GLB"""
    print(f"Exporting to: {output_path}")

    # Select objects to export
    bpy.ops.object.select_all(action='DESELECT')
    armature.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = armature

    # Export GLB
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        use_selection=True,
        export_animations=True,
        export_nla_strips=True,
        export_apply=True,
    )

    print(f"Export complete!")

def process_character(character_name):
    """Process a single character"""
    if character_name not in CONFIG:
        raise ValueError(f"Unknown character: {character_name}. Available: {list(CONFIG.keys())}")

    config = CONFIG[character_name]

    print(f"\n{'='*60}")
    print(f"Processing character: {character_name}")
    print(f"{'='*60}\n")

    # Step 1: Clear scene
    clear_scene()

    # Step 2: Import mesh
    armature, mesh = import_character_mesh(config)
    print(f"Mesh imported: {mesh.name}")

    # Step 3: Import animations
    anim_dir = config['animations_dir']
    for anim_name, anim_file in ANIMATION_FILES.items():
        anim_path = os.path.join(anim_dir, anim_file)
        import_mixamo_animation(anim_path, anim_name, armature)

    # Step 4: Export GLB
    export_glb(armature, mesh, config['output_path'])

    print(f"\nCharacter {character_name} processed successfully!")
    print(f"Output: {config['output_path']}")

# =============================================================================
# MAIN EXECUTION
# =============================================================================

if __name__ == "__main__":
    process_character(CHARACTER)
