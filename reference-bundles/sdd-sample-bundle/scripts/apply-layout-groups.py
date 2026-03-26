#!/usr/bin/env python3
"""
Apply x-sdd-layoutGroups and per-field x-sdd-layoutGroup (+ prominence) to all schemas
that are missing them, modelling the ADR pattern.

Tab taxonomy used across all types:
  overview       – identity + primary content (description, text, rationale etc.)
  details        – type-specific structured data (steps, endpoints, checks, etc.)
  traceability   – all cross-reference *Ids / *Ids arrays
  meta           – tags, owner, dates (extra), misc

Schemas that are simple enough (≤10 non-header fields) get only overview + traceability/meta.
"""

import json
import os
import glob
import copy

SCHEMA_DIR = '/home/ivan/dev/sdd-sample-bundle/schemas'

# ---------------------------------------------------------------------------
# Per-schema layout plan: { field_name: (group, extra_attrs) }
# extra_attrs goes into the field's x-sdd-* properties
# ---------------------------------------------------------------------------

LAYOUTS = {

    # -----------------------------------------------------------------------
    'Actor': {
        '_groups': {
            'overview': {'title': 'Overview', 'order': 1},
            'meta':     {'title': 'Meta',     'order': 2},
        },
        '_fields': {
            'id':               ('overview', {'x-sdd-displayHint': 'hidden'}),
            'name':             ('overview', {'x-sdd-order': 10}),
            'kind':             ('overview', {'x-sdd-order': 20}),
            'description':      ('overview', {
                'x-sdd-prominence': 'secondary',
                'x-sdd-prominenceLabel': 'About this Actor',
                'x-sdd-prominenceIcon': '👤',
                'x-sdd-order': 30,
            }),
            'responsibilities': ('overview', {'x-sdd-layout': 'bulletList', 'x-sdd-order': 40}),
            'tags':             ('meta',     {'x-sdd-displayHint': 'chips', 'x-sdd-order': 99}),
        },
    },

    # -----------------------------------------------------------------------
    'Component': {
        '_groups': {
            'overview':      {'title': 'Overview',      'order': 1},
            'technical':     {'title': 'Technical',     'order': 2},
            'traceability':  {'title': 'Traceability',  'order': 3},
            'meta':          {'title': 'Meta',          'order': 4},
        },
        '_fields': {
            'id':                         ('overview',     {'x-sdd-displayHint': 'hidden'}),
            'title':                      ('overview',     {'x-sdd-order': 10}),
            'kind':                       ('overview',     {'x-sdd-order': 20}),
            'description':                ('overview',     {
                'x-sdd-prominence': 'secondary',
                'x-sdd-prominenceLabel': 'What it does',
                'x-sdd-prominenceIcon': '📦',
                'x-sdd-order': 30,
            }),
            'responsibilities':           ('overview',     {
                'x-sdd-prominence': 'secondary',
                'x-sdd-prominenceLabel': 'Responsibilities',
                'x-sdd-prominenceIcon': '📋',
                'x-sdd-order': 40,
            }),
            'technology':                 ('technical',    {'x-sdd-order': 10}),
            'repository':                 ('technical',    {'x-sdd-order': 20}),
            'owner':                      ('technical',    {'x-sdd-order': 30}),
            'dependsOn':                  ('technical',    {'x-sdd-order': 40}),
            'providesProtocols':          ('technical',    {'x-sdd-order': 50}),
            'consumesProtocols':          ('technical',    {'x-sdd-order': 60}),
            'constrainedByConstraintIds': ('traceability', {'x-sdd-order': 10}),
            'affectedByThreatIds':        ('traceability', {'x-sdd-order': 20}),
            'governedByPolicyIds':        ('traceability', {'x-sdd-order': 30}),
            'usedByActorIds':             ('traceability', {'x-sdd-order': 40}),
            'usedInScenarioIds':          ('traceability', {'x-sdd-order': 50}),
            'telemetrySchemaIds':         ('traceability', {'x-sdd-order': 60}),
            'tags':                       ('meta',         {'x-sdd-displayHint': 'chips', 'x-sdd-order': 99}),
        },
    },

    # -----------------------------------------------------------------------
    'Constraint': {
        '_groups': {
            'overview':     {'title': 'Overview',     'order': 1},
            'measurement':  {'title': 'Measurement',  'order': 2},
            'traceability': {'title': 'Traceability', 'order': 3},
            'meta':         {'title': 'Meta',         'order': 4},
        },
        '_fields': {
            'id':                    ('overview',    {'x-sdd-displayHint': 'hidden'}),
            'title':                 ('overview',    {'x-sdd-order': 10}),
            'kind':                  ('overview',    {'x-sdd-order': 20}),
            'severity':              ('overview',    {'x-sdd-order': 25}),
            'text':                  ('overview',    {
                'x-sdd-prominence': 'hero',
                'x-sdd-prominenceLabel': 'The Constraint',
                'x-sdd-prominenceIcon': '🚧',
                'x-sdd-order': 30,
            }),
            'rationale':             ('overview',    {
                'x-sdd-prominence': 'secondary',
                'x-sdd-prominenceLabel': 'Rationale',
                'x-sdd-prominenceIcon': '💡',
                'x-sdd-order': 40,
            }),
            'measurable':            ('measurement', {'x-sdd-order': 10}),
            'derivedFromPolicyId':   ('traceability', {'x-sdd-order': 10}),
            'tags':                  ('meta',        {'x-sdd-displayHint': 'chips', 'x-sdd-order': 99}),
        },
    },

    # -----------------------------------------------------------------------
    'DataSchema': {
        '_groups': {
            'overview':     {'title': 'Overview',     'order': 1},
            'content':      {'title': 'Content',      'order': 2},
            'traceability': {'title': 'Traceability', 'order': 3},
            'meta':         {'title': 'Meta',         'order': 4},
        },
        '_fields': {
            'id':              ('overview',     {'x-sdd-displayHint': 'hidden'}),
            'name':            ('overview',     {'x-sdd-order': 10}),
            'format':          ('overview',     {'x-sdd-order': 20}),
            'usage':           ('overview',     {'x-sdd-order': 25}),
            'description':     ('overview',     {
                'x-sdd-prominence': 'secondary',
                'x-sdd-prominenceLabel': 'Description',
                'x-sdd-prominenceIcon': '📄',
                'x-sdd-order': 30,
            }),
            'summary':         ('overview',     {
                'x-sdd-prominence': 'secondary',
                'x-sdd-prominenceLabel': 'Summary',
                'x-sdd-prominenceIcon': '📝',
                'x-sdd-order': 35,
            }),
            'content':         ('content',      {'x-sdd-order': 10}),
            'location':        ('content',      {'x-sdd-order': 20}),
            'usedInProtocols': ('traceability', {'x-sdd-order': 10}),
            'tags':            ('meta',         {'x-sdd-displayHint': 'chips', 'x-sdd-order': 99}),
        },
    },

    # -----------------------------------------------------------------------
    'Decision': {
        '_groups': {
            'overview':     {'title': 'Overview',     'order': 1},
            'traceability': {'title': 'Traceability', 'order': 2},
            'meta':         {'title': 'Meta',         'order': 3},
        },
        '_fields': {
            'id':                   ('overview',     {'x-sdd-displayHint': 'hidden'}),
            'title':                ('overview',     {'x-sdd-order': 10}),
            'outcome':              ('overview',     {'x-sdd-order': 20}),
            'date':                 ('overview',     {'x-sdd-order': 25}),
            'rationale':            ('overview',     {
                'x-sdd-prominence': 'secondary',
                'x-sdd-prominenceLabel': 'Rationale',
                'x-sdd-prominenceIcon': '💡',
                'x-sdd-order': 30,
            }),
            'participants':         ('overview',     {'x-sdd-layout': 'bulletList', 'x-sdd-order': 40}),
            'relatedDecisionIds':   ('traceability', {'x-sdd-order': 10}),
            'originatingAdrIds':    ('traceability', {'x-sdd-order': 20}),
        },
    },

    # -----------------------------------------------------------------------
    'ErrorCode': {
        '_groups': {
            'overview':     {'title': 'Overview',     'order': 1},
            'traceability': {'title': 'Traceability', 'order': 2},
            'meta':         {'title': 'Meta',         'order': 3},
        },
        '_fields': {
            'id':                           ('overview',     {'x-sdd-displayHint': 'hidden'}),
            'title':                        ('overview',     {'x-sdd-order': 10}),
            'httpStatus':                   ('overview',     {'x-sdd-order': 20}),
            'machineCode':                  ('overview',     {'x-sdd-order': 25}),
            'category':                     ('overview',     {'x-sdd-order': 30}),
            'humanMessage':                 ('overview',     {'x-sdd-order': 35}),
            'problemDetailsSchemaId':       ('overview',     {'x-sdd-order': 40}),
            'raisedInScenarios':            ('traceability', {'x-sdd-order': 10}),
            'documentedInProtocols':        ('traceability', {'x-sdd-order': 20}),
            'referencedInTelemetrySchemas': ('traceability', {'x-sdd-order': 30}),
            'tags':                         ('meta',         {'x-sdd-displayHint': 'chips', 'x-sdd-order': 99}),
        },
    },

    # -----------------------------------------------------------------------
    'Feature': {
        '_groups': {
            'overview':     {'title': 'Overview',     'order': 1},
            'traceability': {'title': 'Traceability', 'order': 2},
            'meta':         {'title': 'Meta',         'order': 3},
        },
        '_fields': {
            'id':                       ('overview',     {'x-sdd-displayHint': 'hidden'}),
            'title':                    ('overview',     {'x-sdd-order': 10}),
            'description':              ('overview',     {
                'x-sdd-prominence': 'secondary',
                'x-sdd-prominenceLabel': 'Feature Description',
                'x-sdd-prominenceIcon': '✨',
                'x-sdd-order': 30,
            }),
            'governedByAdrIds':         ('traceability', {'x-sdd-order': 10}),
            'realizedByRequirementIds': ('traceability', {'x-sdd-order': 20}),
            'affectedByDecisionIds':    ('traceability', {'x-sdd-order': 30}),
            'implementedByComponentIds':('traceability', {'x-sdd-order': 40}),
            'requiredByProfileIds':     ('traceability', {'x-sdd-order': 50}),
            'optionalInProfileIds':     ('traceability', {'x-sdd-order': 60}),
            'tags':                     ('meta',         {'x-sdd-displayHint': 'chips', 'x-sdd-order': 99}),
        },
    },

    # -----------------------------------------------------------------------
    'Fixture': {
        '_groups': {
            'overview':     {'title': 'Overview',     'order': 1},
            'spec':         {'title': 'Spec & Data',  'order': 2},
            'traceability': {'title': 'Traceability', 'order': 3},
        },
        '_fields': {
            'id':                  ('overview',     {'x-sdd-displayHint': 'hidden'}),
            'title':               ('overview',     {'x-sdd-order': 10}),
            'kind':                ('overview',     {'x-sdd-order': 20}),
            'description':         ('overview',     {
                'x-sdd-prominence': 'secondary',
                'x-sdd-prominenceLabel': 'Description',
                'x-sdd-prominenceIcon': '🧪',
                'x-sdd-order': 30,
            }),
            'spec':                ('spec',         {'x-sdd-order': 10}),
            'data':                ('spec',         {'x-sdd-order': 20}),
            'belongsToFeatureIds': ('traceability', {'x-sdd-order': 10}),
            'usedInScenarios':     ('traceability', {'x-sdd-order': 20}),
            'usedInScenarioIds':   ('traceability', {'x-sdd-order': 30}),
        },
    },

    # -----------------------------------------------------------------------
    'HealthCheckSpec': {
        '_groups': {
            'overview':     {'title': 'Overview',     'order': 1},
            'checks':       {'title': 'Checks',       'order': 2},
            'traceability': {'title': 'Traceability', 'order': 3},
            'meta':         {'title': 'Meta',         'order': 4},
        },
        '_fields': {
            'id':                   ('overview',     {'x-sdd-displayHint': 'hidden'}),
            'title':                ('overview',     {'x-sdd-order': 10}),
            'exposedByProtocolId':  ('overview',     {'x-sdd-order': 20}),
            'path':                 ('overview',     {'x-sdd-order': 25}),
            'description':          ('overview',     {
                'x-sdd-prominence': 'secondary',
                'x-sdd-prominenceLabel': 'Description',
                'x-sdd-prominenceIcon': '🏥',
                'x-sdd-order': 30,
            }),
            'checks':               ('checks',       {'x-sdd-order': 10}),
            'semantics':            ('checks',       {'x-sdd-order': 20}),
            'relatedComponents':    ('traceability', {'x-sdd-order': 10}),
            'coveredByScenarios':   ('traceability', {'x-sdd-order': 20}),
            'tags':                 ('meta',         {'x-sdd-displayHint': 'chips', 'x-sdd-order': 99}),
        },
    },

    # -----------------------------------------------------------------------
    'OpenQuestion': {
        '_groups': {
            'overview':     {'title': 'Overview',     'order': 1},
            'resolution':   {'title': 'Resolution',   'order': 2},
            'traceability': {'title': 'Traceability', 'order': 3},
            'meta':         {'title': 'Meta',         'order': 4},
        },
        '_fields': {
            'id':                   ('overview',    {'x-sdd-displayHint': 'hidden'}),
            'status':               ('overview',    {'x-sdd-order': 5}),
            'question':             ('overview',    {
                'x-sdd-prominence': 'hero',
                'x-sdd-prominenceLabel': 'The Question',
                'x-sdd-prominenceIcon': '❓',
                'x-sdd-order': 10,
            }),
            'context':              ('overview',    {
                'x-sdd-prominence': 'secondary',
                'x-sdd-prominenceLabel': 'The Context',
                'x-sdd-prominenceIcon': '🧭',
                'x-sdd-order': 20,
            }),
            'answer':               ('resolution',  {
                'x-sdd-prominence': 'hero',
                'x-sdd-prominenceLabel': 'The Answer',
                'x-sdd-prominenceIcon': '✅',
                'x-sdd-order': 10,
            }),
            'decidedBy':            ('resolution',  {'x-sdd-order': 20}),
            'decidedDate':          ('resolution',  {'x-sdd-order': 30}),
            'touchesRequirements':  ('traceability', {'x-sdd-order': 10}),
            'touchesAdrs':          ('traceability', {'x-sdd-order': 20}),
            'touchesScenarios':     ('traceability', {'x-sdd-order': 30}),
            'tags':                 ('meta',        {'x-sdd-displayHint': 'chips', 'x-sdd-order': 99}),
        },
    },

    # -----------------------------------------------------------------------
    'Policy': {
        '_groups': {
            'overview':     {'title': 'Overview',     'order': 1},
            'traceability': {'title': 'Traceability', 'order': 2},
            'meta':         {'title': 'Meta',         'order': 3},
        },
        '_fields': {
            'id':                    ('overview',     {'x-sdd-displayHint': 'hidden'}),
            'title':                 ('overview',     {'x-sdd-order': 10}),
            'category':              ('overview',     {'x-sdd-order': 20}),
            'status':                ('overview',     {'x-sdd-order': 25}),
            'text':                  ('overview',     {
                'x-sdd-prominence': 'hero',
                'x-sdd-prominenceLabel': 'The Policy',
                'x-sdd-prominenceIcon': '📜',
                'x-sdd-order': 30,
            }),
            'rationale':             ('overview',     {
                'x-sdd-prominence': 'secondary',
                'x-sdd-prominenceLabel': 'Rationale',
                'x-sdd-prominenceIcon': '💡',
                'x-sdd-order': 40,
            }),
            'enforcedByConstraints': ('traceability', {'x-sdd-order': 10}),
            'tags':                  ('meta',         {'x-sdd-displayHint': 'chips', 'x-sdd-order': 99}),
        },
    },

    # -----------------------------------------------------------------------
    'Principle': {
        '_groups': {
            'overview':     {'title': 'Overview',     'order': 1},
            'traceability': {'title': 'Traceability', 'order': 2},
            'meta':         {'title': 'Meta',         'order': 3},
        },
        '_fields': {
            'id':           ('overview',     {'x-sdd-displayHint': 'hidden'}),
            'title':        ('overview',     {'x-sdd-order': 10}),
            'status':       ('overview',     {'x-sdd-order': 20}),
            'category':     ('overview',     {'x-sdd-order': 25}),
            'description':  ('overview',     {
                'x-sdd-prominence': 'hero',
                'x-sdd-prominenceLabel': 'The Principle',
                'x-sdd-prominenceIcon': '⭐',
                'x-sdd-order': 30,
            }),
            'rationale':    ('overview',     {
                'x-sdd-prominence': 'secondary',
                'x-sdd-prominenceLabel': 'Rationale',
                'x-sdd-prominenceIcon': '💡',
                'x-sdd-order': 40,
            }),
            'implications': ('overview',     {'x-sdd-layout': 'bulletList', 'x-sdd-order': 50}),
            'tags':         ('meta',         {'x-sdd-displayHint': 'chips', 'x-sdd-order': 99}),
        },
    },

    # -----------------------------------------------------------------------
    'Profile': {
        '_groups': {
            'overview': {'title': 'Overview', 'order': 1},
            'template': {'title': 'Template', 'order': 2},
        },
        '_fields': {
            'id':               ('overview', {'x-sdd-displayHint': 'hidden'}),
            'title':            ('overview', {'x-sdd-order': 10}),
            'description':      ('overview', {
                'x-sdd-prominence': 'secondary',
                'x-sdd-prominenceLabel': 'Description',
                'x-sdd-prominenceIcon': '🗂️',
                'x-sdd-order': 30,
            }),
            'conformanceRules': ('overview', {'x-sdd-layout': 'bulletList', 'x-sdd-order': 40}),
            'auditTemplate':    ('template', {
                'x-sdd-prominence': 'hero',
                'x-sdd-prominenceLabel': 'Audit Template',
                'x-sdd-prominenceIcon': '📋',
                'x-sdd-order': 10,
            }),
        },
    },

    # -----------------------------------------------------------------------
    'Protocol': {
        '_groups': {
            'overview':     {'title': 'Overview',     'order': 1},
            'technical':    {'title': 'Technical',    'order': 2},
            'endpoints':    {'title': 'Endpoints',    'order': 3},
            'traceability': {'title': 'Traceability', 'order': 4},
            'meta':         {'title': 'Meta',         'order': 5},
        },
        '_fields': {
            'id':                    ('overview',     {'x-sdd-displayHint': 'hidden'}),
            'title':                 ('overview',     {'x-sdd-order': 10}),
            'version':               ('overview',     {'x-sdd-order': 20}),
            'kind':                  ('overview',     {'x-sdd-order': 25}),
            'role':                  ('overview',     {'x-sdd-order': 30}),
            'description':           ('overview',     {
                'x-sdd-prominence': 'secondary',
                'x-sdd-prominenceLabel': 'Description',
                'x-sdd-prominenceIcon': '🔌',
                'x-sdd-order': 40,
            }),
            'summary':               ('overview',     {
                'x-sdd-prominence': 'secondary',
                'x-sdd-prominenceLabel': 'Summary',
                'x-sdd-prominenceIcon': '📝',
                'x-sdd-order': 35,
            }),
            'transport':             ('technical',    {'x-sdd-order': 10}),
            'authentication':        ('technical',    {'x-sdd-order': 20}),
            'securityModel':         ('technical',    {'x-sdd-order': 30}),
            'nfrBindings':           ('technical',    {'x-sdd-order': 40}),
            'externalSpecRefs':      ('technical',    {'x-sdd-order': 50}),
            'endpoints':             ('endpoints',    {'x-sdd-order': 10}),
            'providedByComponents':  ('traceability', {'x-sdd-order': 10}),
            'consumedByComponents':  ('traceability', {'x-sdd-order': 20}),
            'supportsFeatureIds':    ('traceability', {'x-sdd-order': 30}),
            'governedByAdrIds':      ('traceability', {'x-sdd-order': 40}),
            'affectedByThreatIds':   ('traceability', {'x-sdd-order': 50}),
            'governedByPolicyIds':   ('traceability', {'x-sdd-order': 60}),
            'usedInScenarioIds':     ('traceability', {'x-sdd-order': 70}),
            'telemetrySchemaIds':    ('traceability', {'x-sdd-order': 80}),
        },
    },

    # -----------------------------------------------------------------------
    'Requirement': {
        '_groups': {
            'overview':     {'title': 'Overview',     'order': 1},
            'verification': {'title': 'Verification', 'order': 2},
            'traceability': {'title': 'Traceability', 'order': 3},
            'meta':         {'title': 'Meta',         'order': 4},
        },
        '_fields': {
            'id':                          ('overview',     {'x-sdd-displayHint': 'hidden'}),
            'title':                       ('overview',     {'x-sdd-order': 10}),
            'kind':                        ('overview',     {'x-sdd-order': 20}),
            'category':                    ('overview',     {'x-sdd-order': 25}),
            'subtype':                     ('overview',     {'x-sdd-order': 27}),
            'source':                      ('overview',     {'x-sdd-order': 28}),
            'description':                 ('overview',     {
                'x-sdd-prominence': 'hero',
                'x-sdd-prominenceLabel': 'The Requirement',
                'x-sdd-prominenceIcon': '📋',
                'x-sdd-order': 30,
            }),
            'rationale':                   ('overview',     {
                'x-sdd-prominence': 'secondary',
                'x-sdd-prominenceLabel': 'The Rationale',
                'x-sdd-prominenceIcon': '💡',
                'x-sdd-order': 40,
            }),
            'qualityAttributes':           ('verification', {'x-sdd-order': 10}),
            'acceptanceCriteria':          ('verification', {'x-sdd-layout': 'bulletList', 'x-sdd-order': 20}),
            'ownerId':                     ('meta',         {'x-sdd-order': 10}),
            'requestedById':               ('meta',         {'x-sdd-order': 20}),
            'implementedById':             ('meta',         {'x-sdd-order': 30}),
            'parentId':                    ('meta',         {'x-sdd-order': 40}),
            'governedByAdrIds':            ('traceability', {'x-sdd-order': 10}),
            'realizedByComponents':        ('traceability', {'x-sdd-order': 20}),
            'refinesRequirements':         ('traceability', {'x-sdd-order': 30}),
            'constrainedByConstraintIds':  ('traceability', {'x-sdd-order': 40}),
            'governedByPolicyIds':         ('traceability', {'x-sdd-order': 50}),
            'guidedByPrincipleIds':        ('traceability', {'x-sdd-order': 60}),
            'implementedByComponentIds':   ('traceability', {'x-sdd-order': 70}),
            'coveredByScenarioIds':        ('traceability', {'x-sdd-order': 80}),
            'validatedByFixtureIds':       ('traceability', {'x-sdd-order': 90}),
        },
    },

    # -----------------------------------------------------------------------
    'Risk': {
        '_groups': {
            'overview':     {'title': 'Overview',     'order': 1},
            'mitigation':   {'title': 'Mitigation',   'order': 2},
            'traceability': {'title': 'Traceability', 'order': 3},
            'meta':         {'title': 'Meta',         'order': 4},
        },
        '_fields': {
            'id':                   ('overview',    {'x-sdd-displayHint': 'hidden'}),
            'title':                ('overview',    {'x-sdd-order': 10}),
            'status':               ('overview',    {'x-sdd-order': 15}),
            'owner':                ('overview',    {'x-sdd-order': 18}),
            'likelihood':           ('overview',    {'x-sdd-order': 20}),
            'impact':               ('overview',    {'x-sdd-order': 25}),
            'description':          ('overview',    {
                'x-sdd-prominence': 'hero',
                'x-sdd-prominenceLabel': 'The Risk',
                'x-sdd-prominenceIcon': '⚠️',
                'x-sdd-order': 30,
            }),
            'mitigation':           ('mitigation',  {
                'x-sdd-prominence': 'hero',
                'x-sdd-prominenceLabel': 'Mitigation Strategy',
                'x-sdd-prominenceIcon': '🛡️',
                'x-sdd-order': 10,
            }),
            'relatedRequirements':  ('traceability', {'x-sdd-order': 10}),
            'relatedAdrs':          ('traceability', {'x-sdd-order': 20}),
            'relatedComponents':    ('traceability', {'x-sdd-order': 30}),
            'relatedScenarios':     ('traceability', {'x-sdd-order': 40}),
            'relatedThreats':       ('traceability', {'x-sdd-order': 50}),
            'tags':                 ('meta',        {'x-sdd-displayHint': 'chips', 'x-sdd-order': 99}),
        },
    },

    # -----------------------------------------------------------------------
    'Scenario': {
        '_groups': {
            'overview':     {'title': 'Overview',     'order': 1},
            'flow':         {'title': 'Flow',         'order': 2},
            'traceability': {'title': 'Traceability', 'order': 3},
            'meta':         {'title': 'Meta',         'order': 4},
        },
        '_fields': {
            'id':                          ('overview',     {'x-sdd-displayHint': 'hidden'}),
            'title':                       ('overview',     {'x-sdd-order': 10}),
            'viewpoint':                   ('overview',     {'x-sdd-order': 20}),
            'intent':                      ('overview',     {
                'x-sdd-prominence': 'hero',
                'x-sdd-prominenceLabel': 'The Intent',
                'x-sdd-prominenceIcon': '🎯',
                'x-sdd-order': 30,
            }),
            'preconditions':               ('flow',         {'x-sdd-layout': 'bulletList', 'x-sdd-order': 10}),
            'steps':                       ('flow',         {'x-sdd-order': 20}),
            'postconditions':              ('flow',         {'x-sdd-layout': 'bulletList', 'x-sdd-order': 30}),
            'constrainedByConstraintIds':  ('traceability', {'x-sdd-order': 10}),
            'telemetrySchemaIds':          ('traceability', {'x-sdd-order': 20}),
            'tags':                        ('meta',         {'x-sdd-displayHint': 'chips', 'x-sdd-order': 99}),
        },
    },

    # -----------------------------------------------------------------------
    'Task': {
        '_groups': {
            'overview':     {'title': 'Overview',     'order': 1},
            'traceability': {'title': 'Traceability', 'order': 2},
        },
        '_fields': {
            'id':                      ('overview',     {'x-sdd-displayHint': 'hidden'}),
            'title':                   ('overview',     {'x-sdd-order': 10}),
            'status':                  ('overview',     {'x-sdd-order': 20}),
            'description':             ('overview',     {
                'x-sdd-prominence': 'secondary',
                'x-sdd-prominenceLabel': 'Description',
                'x-sdd-prominenceIcon': '✅',
                'x-sdd-order': 30,
            }),
            'fulfillsRequirementIds':  ('traceability', {'x-sdd-order': 10}),
            'belongsToFeatureIds':     ('traceability', {'x-sdd-order': 20}),
        },
    },

    # -----------------------------------------------------------------------
    'TelemetryContract': {
        '_groups': {
            'overview':     {'title': 'Overview',     'order': 1},
            'expectations': {'title': 'Expectations', 'order': 2},
            'traceability': {'title': 'Traceability', 'order': 3},
            'meta':         {'title': 'Meta',         'order': 4},
        },
        '_fields': {
            'id':                    ('overview',     {'x-sdd-displayHint': 'hidden'}),
            'title':                 ('overview',     {'x-sdd-order': 10}),
            'forScenarioId':         ('overview',     {'x-sdd-order': 20}),
            'ciEnforcement':         ('overview',     {'x-sdd-order': 25}),
            'description':           ('overview',     {
                'x-sdd-prominence': 'secondary',
                'x-sdd-prominenceLabel': 'Description',
                'x-sdd-prominenceIcon': '📡',
                'x-sdd-order': 30,
            }),
            'expectations':          ('expectations', {'x-sdd-order': 10}),
            'telemetrySchemaIds':    ('traceability', {'x-sdd-order': 10}),
            'boundByConstraints':    ('traceability', {'x-sdd-order': 20}),
            'linkedErrorCodes':      ('traceability', {'x-sdd-order': 30}),
            'tags':                  ('meta',         {'x-sdd-displayHint': 'chips', 'x-sdd-order': 99}),
        },
    },

    # -----------------------------------------------------------------------
    'TelemetrySchema': {
        '_groups': {
            'overview':     {'title': 'Overview',     'order': 1},
            'signals':      {'title': 'Signals',      'order': 2},
            'meta':         {'title': 'Meta',         'order': 3},
        },
        '_fields': {
            'id':                   ('overview',  {'x-sdd-displayHint': 'hidden'}),
            'title':                ('overview',  {'x-sdd-order': 10}),
            'kind':                 ('overview',  {'x-sdd-order': 20}),
            'signalConvention':     ('overview',  {'x-sdd-order': 25}),
            'description':          ('overview',  {
                'x-sdd-prominence': 'secondary',
                'x-sdd-prominenceLabel': 'Description',
                'x-sdd-prominenceIcon': '📊',
                'x-sdd-order': 30,
            }),
            'spanNames':            ('signals',   {'x-sdd-layout': 'bulletList', 'x-sdd-order': 10}),
            'metricNames':          ('signals',   {'x-sdd-layout': 'bulletList', 'x-sdd-order': 20}),
            'logCategories':        ('signals',   {'x-sdd-layout': 'bulletList', 'x-sdd-order': 30}),
            'attributes':           ('signals',   {'x-sdd-order': 40}),
            'w3cHeaders':           ('signals',   {'x-sdd-order': 50}),
            'exportDestinations':   ('signals',   {'x-sdd-layout': 'bulletList', 'x-sdd-order': 60}),
            'tags':                 ('meta',      {'x-sdd-displayHint': 'chips', 'x-sdd-order': 99}),
        },
    },

    # -----------------------------------------------------------------------
    'Threat': {
        '_groups': {
            'overview':     {'title': 'Overview',     'order': 1},
            'assessment':   {'title': 'Assessment',   'order': 2},
            'traceability': {'title': 'Traceability', 'order': 3},
            'meta':         {'title': 'Meta',         'order': 4},
        },
        '_fields': {
            'id':                      ('overview',    {'x-sdd-displayHint': 'hidden'}),
            'title':                   ('overview',    {'x-sdd-order': 10}),
            'category':                ('overview',    {'x-sdd-order': 20}),
            'attackSurface':           ('overview',    {'x-sdd-order': 25}),
            'description':             ('overview',    {
                'x-sdd-prominence': 'hero',
                'x-sdd-prominenceLabel': 'The Threat',
                'x-sdd-prominenceIcon': '🔴',
                'x-sdd-order': 30,
            }),
            'likelihood':              ('assessment',  {'x-sdd-order': 10}),
            'impact':                  ('assessment',  {'x-sdd-order': 20}),
            'status':                  ('assessment',  {'x-sdd-order': 25}),
            'assetsAtRisk':            ('assessment',  {'x-sdd-layout': 'bulletList', 'x-sdd-order': 30}),
            'mitigatedByRequirements': ('traceability', {'x-sdd-order': 10}),
            'relatedToRisks':          ('traceability', {'x-sdd-order': 20}),
            'documentedInAdrs':        ('traceability', {'x-sdd-order': 30}),
            'tags':                    ('meta',        {'x-sdd-displayHint': 'chips', 'x-sdd-order': 99}),
        },
    },

    # -----------------------------------------------------------------------
    'View': {
        '_groups': {
            'overview':     {'title': 'Overview',     'order': 1},
            'diagram':      {'title': 'Diagram',      'order': 2},
            'traceability': {'title': 'Traceability', 'order': 3},
            'meta':         {'title': 'Meta',         'order': 4},
        },
        '_fields': {
            'id':                  ('overview',     {'x-sdd-displayHint': 'hidden'}),
            'name':                ('overview',     {'x-sdd-order': 10}),
            'fromViewpointId':     ('overview',     {'x-sdd-order': 20}),
            'viewpointId':         ('overview',     {'x-sdd-order': 21}),
            'outputPath':          ('overview',     {'x-sdd-order': 25}),
            'description':         ('overview',     {
                'x-sdd-prominence': 'secondary',
                'x-sdd-prominenceLabel': 'Description',
                'x-sdd-prominenceIcon': '🗺️',
                'x-sdd-order': 30,
            }),
            'scope':               ('diagram',      {'x-sdd-order': 10}),
            'plantuml':            ('diagram',      {
                'x-sdd-prominence': 'hero',
                'x-sdd-prominenceLabel': 'PlantUML Source',
                'x-sdd-prominenceIcon': '🎨',
                'x-sdd-order': 20,
            }),
            'referencedEntities':  ('traceability', {'x-sdd-order': 10}),
            'tags':                ('meta',         {'x-sdd-displayHint': 'chips', 'x-sdd-order': 99}),
        },
    },

    # -----------------------------------------------------------------------
    'Viewpoint': {
        '_groups': {
            'overview':  {'title': 'Overview',  'order': 1},
            'template':  {'title': 'Template',  'order': 2},
            'meta':      {'title': 'Meta',      'order': 3},
        },
        '_fields': {
            'id':                  ('overview', {'x-sdd-displayHint': 'hidden'}),
            'name':                ('overview', {'x-sdd-order': 10}),
            'diagramKind':         ('overview', {'x-sdd-order': 20}),
            'description':         ('overview', {
                'x-sdd-prominence': 'secondary',
                'x-sdd-prominenceLabel': 'Description',
                'x-sdd-prominenceIcon': '🔭',
                'x-sdd-order': 30,
            }),
            'allowedEntityTypes':  ('overview', {'x-sdd-layout': 'bulletList', 'x-sdd-order': 40}),
            'selectionDefaults':   ('template', {'x-sdd-order': 10}),
            'plantumlTemplate':    ('template', {
                'x-sdd-prominence': 'hero',
                'x-sdd-prominenceLabel': 'PlantUML Template',
                'x-sdd-prominenceIcon': '🎨',
                'x-sdd-order': 20,
            }),
            'tags':                ('meta',     {'x-sdd-displayHint': 'chips', 'x-sdd-order': 99}),
        },
    },
}


def apply_layout(schema_name: str, layout: dict) -> bool:
    path = os.path.join(SCHEMA_DIR, f'{schema_name}.schema.json')
    if not os.path.exists(path):
        print(f'  SKIP {schema_name} — file not found')
        return False

    with open(path) as f:
        schema = json.load(f)

    groups = layout.get('_groups', {})
    fields = layout.get('_fields', {})

    # Set root-level layoutGroups
    schema['x-sdd-layoutGroups'] = groups

    props = schema.get('properties', {})
    for field_name, (group, extra) in fields.items():
        if field_name not in props:
            continue
        p = props[field_name]
        p['x-sdd-layoutGroup'] = group
        for k, v in extra.items():
            p[k] = v

    with open(path, 'w') as f:
        json.dump(schema, f, indent=2, ensure_ascii=False)
        f.write('\n')

    print(f'  ✓ {schema_name}: {len(groups)} groups, {len(fields)} field annotations')
    return True


if __name__ == '__main__':
    print('Applying layout groups to all schemas...\n')
    updated = 0
    for name, layout in LAYOUTS.items():
        if apply_layout(name, layout):
            updated += 1
    print(f'\nDone. Updated {updated}/{len(LAYOUTS)} schemas.')
