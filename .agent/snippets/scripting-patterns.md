# Scripting Patterns

## Markdown Block Re-ordering

When restructuring large Markdown files (like `README.md`) via an AI agent, using line-based or substring replacement tools can be extremely brittle and prone to errors. 

The **preferred pattern** is to execute a local Python script using the `run_command` tool to read, slice, and rewrite the document based on highly specific string anchors.

**Example: Moving a section above another**
```python
import sys

file_path = "README.md"
with open(file_path, "r") as f:
    content = f.read()

# Define highly specific anchor points
start_marker = "## The Section to Move"
end_marker = "## The Section Immediately After"
target_marker = "## Where to Insert Above"

# Identify the block
start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx)

if start_idx != -1 and end_idx != -1 and target_marker in content:
    block_to_move = content[start_idx:end_idx]
    
    # Securely remove the block from its original location
    content = content[:start_idx] + content[end_idx:]
    
    # Re-evaluate the target index after the string length changes
    target_idx = content.find(target_marker)
    
    # Insert the block at the new target
    content = content[:target_idx] + block_to_move + "\n" + content[target_idx:]
    
    with open(file_path, "w") as f:
        f.write(content)
    print("Block moved successfully.")
else:
    print("Failed to find anchors. Aborting.")
```
