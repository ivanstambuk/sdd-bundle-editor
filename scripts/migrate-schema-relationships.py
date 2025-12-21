#!/usr/bin/env python3
"""
Schema Relationship Migration Script

Migrates bundle schemas to follow Target-Holds-Reference convention.
The entity being constrained/governed holds the reference TO its constraints/governors.

Usage:
    python3 scripts/migrate-schema-relationships.py [--dry-run]
"""

import json
import yaml
import os
import sys
from pathlib import Path
from typing import Dict, List, Any, Tuple

BUNDLE_PATH = os.environ.get('SDD_SAMPLE_BUNDLE_PATH', '/home/ivan/dev/sdd-sample-bundle')
SCHEMAS_DIR = Path(BUNDLE_PATH) / 'schemas'
ENTITIES_DIR = Path(BUNDLE_PATH) / 'bundle'

# Map entity types to their folder names (lowercase plural)
ENTITY_FOLDERS = {
    'Feature': 'features',
    'Requirement': 'requirements',
    'Component': 'components',
    'Scenario': 'scenarios',
    'Constraint': 'constraints',
    'Protocol': 'protocols',
    'ADR': 'adrs',
    'Decision': 'decisions',
    'Threat': 'threats',
    'Policy': 'policies',
    'Principle': 'principles',
    'Actor': 'actors',
    'TelemetrySchema': 'telemetry-schemas',
    'Fixture': 'fixtures',
    'Profile': 'profiles',
}

# Migration definitions: (source_schema, source_field) -> (target_schema, new_field)
MIGRATIONS = [
    # Batch 1: Core Governance
    ('Requirement', 'realizesFeatureIds', 'Feature', 'realizedByRequirementIds'),
    ('Constraint', 'constrainsRequirementIds', 'Requirement', 'constrainedByConstraintIds'),
    ('Constraint', 'constrainsScenarioIds', 'Scenario', 'constrainedByConstraintIds'),
    ('Constraint', 'constrainsComponentIds', 'Component', 'constrainedByConstraintIds'),
    ('Decision', 'affectsFeatureIds', 'Feature', 'affectedByDecisionIds'),
    
    # Batch 2: Threat Model
    ('Threat', 'affectsComponents', 'Component', 'affectedByThreatIds'),
    ('Threat', 'affectsProtocols', 'Protocol', 'affectedByThreatIds'),
    ('Policy', 'appliesToProtocols', 'Protocol', 'governedByPolicyIds'),
    ('Policy', 'appliesToComponents', 'Component', 'governedByPolicyIds'),
    ('Policy', 'appliesToRequirements', 'Requirement', 'governedByPolicyIds'),
    
    # Batch 3: Principles & Guidance
    ('Principle', 'guidesAdrs', 'ADR', 'guidedByPrincipleIds'),
    ('Principle', 'guidesRequirements', 'Requirement', 'guidedByPrincipleIds'),
    
    # Batch 4: Implementation Links
    ('Component', 'implementsRequirements', 'Requirement', 'implementedByComponentIds'),
    ('Component', 'implementsFeatureIds', 'Feature', 'implementedByComponentIds'),
    ('Actor', 'ownsRequirements', 'Requirement', 'ownerId'),  # Special case: already exists, just remove from Actor
    ('Actor', 'usesComponents', 'Component', 'usedByActorIds'),
    
    # Batch 5: Operational
    ('Scenario', 'coversRequirements', 'Requirement', 'coveredByScenarioIds'),
    ('Scenario', 'usesComponents', 'Component', 'usedInScenarioIds'),
    ('Scenario', 'usesProtocols', 'Protocol', 'usedInScenarioIds'),
    ('Scenario', 'usesFixtures', 'Fixture', 'usedInScenarioIds'),
    ('Fixture', 'validatesRequirementIds', 'Requirement', 'validatedByFixtureIds'),
    ('Profile', 'requiresFeatures', 'Feature', 'requiredByProfileIds'),
    ('Profile', 'optionalFeatures', 'Feature', 'optionalInProfileIds'),
    ('TelemetrySchema', 'appliesToComponents', 'Component', 'telemetrySchemaIds'),
    ('TelemetrySchema', 'appliesToProtocols', 'Protocol', 'telemetrySchemaIds'),
    ('TelemetrySchema', 'appliesToScenarios', 'Scenario', 'telemetrySchemaIds'),
]

def load_schema(entity_type: str) -> Dict[str, Any]:
    """Load a schema file."""
    path = SCHEMAS_DIR / f'{entity_type}.schema.json'
    with open(path, 'r') as f:
        return json.load(f)

def save_schema(entity_type: str, schema: Dict[str, Any], dry_run: bool = False):
    """Save a schema file."""
    path = SCHEMAS_DIR / f'{entity_type}.schema.json'
    if dry_run:
        print(f"  [DRY RUN] Would save schema: {path}")
    else:
        with open(path, 'w') as f:
            json.dump(schema, f, indent=2)
            f.write('\n')  # Trailing newline
        print(f"  ✓ Saved schema: {path}")

def load_entities(entity_type: str) -> Dict[str, Tuple[Path, Dict[str, Any]]]:
    """Load all entities of a given type. Returns {id: (path, data)}."""
    folder = ENTITY_FOLDERS.get(entity_type)
    if not folder:
        return {}
    
    folder_path = ENTITIES_DIR / folder
    if not folder_path.exists():
        return {}
    
    entities = {}
    for yaml_file in folder_path.glob('*.yaml'):
        with open(yaml_file, 'r') as f:
            data = yaml.safe_load(f)
            if data and 'id' in data:
                entities[data['id']] = (yaml_file, data)
    
    return entities

def save_entity(path: Path, data: Dict[str, Any], dry_run: bool = False):
    """Save an entity YAML file."""
    if dry_run:
        print(f"    [DRY RUN] Would save entity: {path}")
    else:
        with open(path, 'w') as f:
            yaml.dump(data, f, allow_unicode=True, sort_keys=False, default_flow_style=False)
        print(f"    ✓ Saved entity: {path.name}")

def create_reference_field(source_type: str, is_single: bool = False) -> Dict[str, Any]:
    """Create a new reference field definition."""
    if is_single:
        return {
            "type": "string",
            "format": "sdd-ref",
            "x-sdd-refTargets": [source_type],
            "maxLength": 30
        }
    else:
        return {
            "type": "array",
            "items": {
                "type": "string",
                "format": "sdd-ref",
                "x-sdd-refTargets": [source_type]
            },
            "uniqueItems": True
        }

def get_field_title(field_name: str) -> str:
    """Generate a human-readable title from field name."""
    # Remove common suffixes
    name = field_name.replace('Ids', '').replace('Id', '')
    # Split camelCase
    words = []
    current = []
    for char in name:
        if char.isupper() and current:
            words.append(''.join(current).lower())
            current = [char]
        else:
            current.append(char)
    if current:
        words.append(''.join(current).lower())
    return ' '.join(words)

def migrate_relationship(
    source_type: str, 
    source_field: str, 
    target_type: str, 
    new_field: str,
    dry_run: bool = False
) -> Dict[str, int]:
    """Migrate a single relationship."""
    print(f"\n{'─' * 60}")
    print(f"Migrating: {source_type}.{source_field} → {target_type}.{new_field}")
    print(f"{'─' * 60}")
    
    stats = {'schema_updates': 0, 'entities_updated': 0, 'refs_migrated': 0}
    
    # Special case: ownerId already exists on Requirement
    if source_field == 'ownsRequirements' and new_field == 'ownerId':
        print("  Skipping schema update (ownerId already exists on Requirement)")
        # Just need to remove the field from Actor schema
        source_schema = load_schema(source_type)
        if source_field in source_schema.get('properties', {}):
            del source_schema['properties'][source_field]
            save_schema(source_type, source_schema, dry_run)
            stats['schema_updates'] += 1
            print(f"  Removed {source_field} from {source_type} schema")
        return stats
    
    # 1. Update target schema to add new field
    target_schema = load_schema(target_type)
    if new_field not in target_schema.get('properties', {}):
        # Determine field description based on source type
        field_def = create_reference_field(source_type)
        field_def['description'] = f"{source_type}s that affect/apply to this entity"
        field_def['title'] = get_field_title(new_field)
        
        target_schema['properties'][new_field] = field_def
        save_schema(target_type, target_schema, dry_run)
        stats['schema_updates'] += 1
        print(f"  Added {new_field} to {target_type} schema")
    else:
        print(f"  Field {new_field} already exists in {target_type} schema")
    
    # 2. Migrate entity data
    source_entities = load_entities(source_type)
    target_entities = load_entities(target_type)
    
    updated_targets = set()  # Track which target entities were updated
    
    for source_id, (source_path, source_data) in source_entities.items():
        if source_field not in source_data:
            continue
        
        ref_values = source_data[source_field]
        if not ref_values:
            continue
        
        # Ensure it's a list
        if isinstance(ref_values, str):
            ref_values = [ref_values]
        
        # For each reference, add reverse reference to target
        for target_id in ref_values:
            if target_id in target_entities:
                target_path, target_data = target_entities[target_id]
                
                # Initialize the new field if needed
                if new_field not in target_data:
                    target_data[new_field] = []
                
                # Add source reference if not already present
                if source_id not in target_data[new_field]:
                    target_data[new_field].append(source_id)
                    updated_targets.add(target_id)
                    stats['refs_migrated'] += 1
            else:
                print(f"    ⚠ Target not found: {target_id}")
        
        # Remove the field from source entity
        if not dry_run:
            del source_data[source_field]
            save_entity(source_path, source_data, dry_run)
        else:
            print(f"    [DRY RUN] Would remove {source_field} from {source_id}")
    
    # Save updated target entities
    for target_id in updated_targets:
        target_path, target_data = target_entities[target_id]
        save_entity(target_path, target_data, dry_run)
        stats['entities_updated'] += 1
    
    # 3. Remove field from source schema
    source_schema = load_schema(source_type)
    if source_field in source_schema.get('properties', {}):
        del source_schema['properties'][source_field]
        save_schema(source_type, source_schema, dry_run)
        stats['schema_updates'] += 1
        print(f"  Removed {source_field} from {source_type} schema")
    
    print(f"  Summary: {stats['refs_migrated']} refs migrated, {stats['entities_updated']} entities updated")
    return stats

def main():
    dry_run = '--dry-run' in sys.argv
    
    print("=" * 70)
    print("SCHEMA RELATIONSHIP MIGRATION")
    print("Target-Holds-Reference Convention")
    print("=" * 70)
    print(f"\nBundle path: {BUNDLE_PATH}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print(f"Migrations to process: {len(MIGRATIONS)}")
    
    if dry_run:
        print("\n⚠  DRY RUN MODE - No files will be modified\n")
    else:
        print("\n⚡ LIVE MODE - Files will be modified\n")
        response = input("Proceed? (y/N): ")
        if response.lower() != 'y':
            print("Aborted.")
            return
    
    total_stats = {'schema_updates': 0, 'entities_updated': 0, 'refs_migrated': 0}
    
    for source_type, source_field, target_type, new_field in MIGRATIONS:
        try:
            stats = migrate_relationship(source_type, source_field, target_type, new_field, dry_run)
            for k, v in stats.items():
                total_stats[k] += v
        except Exception as e:
            print(f"  ✗ Error: {e}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "=" * 70)
    print("MIGRATION COMPLETE")
    print("=" * 70)
    print(f"Total schema updates: {total_stats['schema_updates']}")
    print(f"Total entities updated: {total_stats['entities_updated']}")
    print(f"Total references migrated: {total_stats['refs_migrated']}")
    
    if dry_run:
        print("\nThis was a DRY RUN. Run without --dry-run to apply changes.")

if __name__ == '__main__':
    main()
