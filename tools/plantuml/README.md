# PlantUML Tooling

This directory contains PlantUML configuration for generating diagrams.

## Setup

1. Download PlantUML JAR to `tools/plantuml/plantuml.jar`:
   ```bash
   curl -L https://github.com/plantuml/plantuml/releases/download/v1.2024.8/plantuml-1.2024.8.jar -o tools/plantuml/plantuml.jar
   ```

2. Requires Java 8+ installed.

## Usage

Compile a single diagram:
```bash
java -jar tools/plantuml/plantuml.jar -config tools/plantuml/sequence-theme.iuml path/to/diagram.puml
```

Compile all diagrams in a directory:
```bash
java -jar tools/plantuml/plantuml.jar -config tools/plantuml/sequence-theme.iuml "**/*.puml"
```

## Theme

The `sequence-theme.iuml` file provides consistent styling:
- White canvas background
- Red lifelines and arrows (#A80036)
- Yellow notes (#FBFB77)
- Beige participants (#FEFECE)
