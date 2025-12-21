#!/usr/bin/env python3
"""
Post-migration cleanup script.

1. Removes leftover fields from entities that are no longer in schemas
2. Fixes relationship titles to follow naming conventions (verb only, no target type)
"""

import json
import yaml
import os
from pathlib import Path
from typing import Dict, List, Any

BUNDLE_PATH = os.environ.get('SDD_SAMPLE_BUNDLE_PATH', '/home/ivan/dev/sdd-sample-bundle')
SCHEMAS_DIR = Path(BUNDLE_PATH) / 'schemas'
ENTITIES_DIR = Path(BUNDLE_PATH) / 'bundle'

# Map entity types to their folder names (lowercase plural)
ENTITY_FOLDERS = {
    'Actor': 'actors',
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
    'TelemetrySchema': 'telemetry-schemas',
    'Fixture': 'fixtures',
    'Profile': 'profiles',
    'Risk': 'risks',
    'OpenQuestion': 'questions',
    'HealthCheckSpec': 'health-checks',
    'TelemetryContract': 'telemetry-contracts',
    'ErrorCode': 'error-codes',
    'View': 'views',
    'Viewpoint': 'viewpoints',
    'DataSchema': 'schemas',
    'Task': 'tasks',
}

# Title corrections for relationship fields
# Format: (schema, field, correct_title)
TITLE_CORRECTIONS = [
    # Feature relationships
    ('Feature', 'realizedByRequirementIds', 'realized by'),
    ('Feature', 'affectedByDecisionIds', 'affected by'),
    ('Feature', 'implementedByComponentIds', 'implemented by'),
    ('Feature', 'requiredByProfileIds', 'required by'),
    ('Feature', 'optionalInProfileIds', 'optional in'),
    
    # Requirement relationships  
    ('Requirement', 'constrainedByConstraintIds', 'constrained by'),
    ('Requirement', 'coveredByScenarioIds', 'covered by'),
    ('Requirement', 'governedByPolicyIds', 'governed by'),
    ('Requirement', 'guidedByPrincipleIds', 'guided by'),
    ('Requirement', 'implementedByComponentIds', 'implemented by'),
    ('Requirement', 'validatedByFixtureIds', 'validated by'),
    
    # Component relationships
    ('Component', 'constrainedByConstraintIds', 'constrained by'),
    ('Component', 'affectedByThreatIds', 'affected by'),
    ('Component', 'governedByPolicyIds', 'governed by'),
    ('Component', 'usedByActorIds', 'used by'),
    ('Component', 'usedInScenarioIds', 'used in'),
    ('Component', 'telemetrySchemaIds', 'observed by'),
    
    # Scenario relationships
    ('Scenario', 'constrainedByConstraintIds', 'constrained by'),
    ('Scenario', 'telemetrySchemaIds', 'observed by'),
    
    # Protocol relationships
    ('Protocol', 'affectedByThreatIds', 'affected by'),
    ('Protocol', 'governedByPolicyIds', 'governed by'),
    ('Protocol', 'usedInScenarioIds', 'used in'),
    ('Protocol', 'telemetrySchemaIds', 'observed by'),
    
    # ADR relationships
    ('ADR', 'guidedByPrincipleIds', 'guided by'),
    
    # Fixture relationships
    ('Fixture', 'usedInScenarioIds', 'used in'),
]


def load_schema(entity_type: str) -> Dict[str, Any]:
    """Load a schema file."""
    path = SCHEMAS_DIR / f'{entity_type}.schema.json'
    if not path.exists():
        return None
    with open(path, 'r') as f:
        return json.load(f)

def save_schema(entity_type: str, schema: Dict[str, Any]):
    """Save a schema file."""
    path = SCHEMAS_DIR / f'{entity_type}.schema.json'
    with open(path, 'w') as f:
        json.dump(schema, f, indent=2)
        f.write('\n')
    print(f"  ✓ Saved schema: {entity_type}")

def get_allowed_fields(entity_type: str) -> set:
    """Get the set of allowed fields for an entity type."""
    schema = load_schema(entity_type)
    if not schema:
        return set()
    return set(schema.get('properties', {}).keys())

def clean_entity_data():
    """Remove fields from entities that are no longer in schemas."""
    print("\n" + "=" * 60)
    print("STEP 1: Clean Entity Data")
    print("=" * 60)
    
    total_cleaned = 0
    
    for entity_type, folder in ENTITY_FOLDERS.items():
        folder_path = ENTITIES_DIR / folder
        if not folder_path.exists():
            continue
        
        allowed_fields = get_allowed_fields(entity_type)
        if not allowed_fields:
            continue
        
        entities_cleaned = 0
        
        for yaml_file in folder_path.glob('*.yaml'):
            with open(yaml_file, 'r') as f:
                data = yaml.safe_load(f)
            
            if not data:
                continue
            
            # Find fields to remove
            fields_to_remove = [k for k in data.keys() if k not in allowed_fields]
            
            if fields_to_remove:
                print(f"  {yaml_file.name}: removing {fields_to_remove}")
                for field in fields_to_remove:
                    del data[field]
                
                with open(yaml_file, 'w') as f:
                    yaml.dump(data, f, allow_unicode=True, sort_keys=False, default_flow_style=False)
                
                entities_cleaned += 1
                total_cleaned += 1
        
        if entities_cleaned > 0:
            print(f"  ✓ Cleaned {entities_cleaned} {entity_type} entities")
    
    print(f"\nTotal entities cleaned: {total_cleaned}")
    return total_cleaned

def fix_relationship_titles():
    """Fix relationship field titles to follow naming conventions."""
    print("\n" + "=" * 60)
    print("STEP 2: Fix Relationship Titles")
    print("=" * 60)
    
    total_fixed = 0
    schemas_updated = set()
    
    for entity_type, field_name, correct_title in TITLE_CORRECTIONS:
        schema = load_schema(entity_type)
        if not schema:
            continue
        
        props = schema.get('properties', {})
        if field_name not in props:
            continue
        
        field_def = props[field_name]
        current_title = field_def.get('title', '')
        
        if current_title != correct_title:
            print(f"  {entity_type}.{field_name}: '{current_title}' → '{correct_title}'")
            field_def['title'] = correct_title
            schemas_updated.add(entity_type)
            total_fixed += 1
    
    # Save updated schemas
    for entity_type in schemas_updated:
        schema = load_schema(entity_type)
        save_schema(entity_type, schema)
    
    # Actually need to re-load and modify
    for entity_type in set(t[0] for t in TITLE_CORRECTIONS):
        schema = load_schema(entity_type)
        if not schema:
            continue
        
        modified = False
        props = schema.get('properties', {})
        
        for et, field_name, correct_title in TITLE_CORRECTIONS:
            if et != entity_type:
                continue
            if field_name not in props:
                continue
            
            if props[field_name].get('title') != correct_title:
                props[field_name]['title'] = correct_title
                modified = True
        
        if modified:
            save_schema(entity_type, schema)
    
    print(f"\nTotal titles fixed: {total_fixed}")
    return total_fixed

def main():
    print("=" * 70)
    print("POST-MIGRATION CLEANUP")
    print("=" * 70)
    print(f"\nBundle path: {BUNDLE_PATH}")
    
    # Step 1: Clean entity data
    entities_cleaned = clean_entity_data()
    
    # Step 2: Fix relationship titles
    titles_fixed = fix_relationship_titles()
    
    print("\n" + "=" * 70)
    print("CLEANUP COMPLETE")
    print("=" * 70)
    print(f"Entities cleaned: {entities_cleaned}")
    print(f"Titles fixed: {titles_fixed}")

if __name__ == '__main__':
    main()
