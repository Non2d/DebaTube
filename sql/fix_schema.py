#!/usr/bin/env python3
"""
Fix schema file by:
1. Adding back DROP TABLE statements
2. Removing problematic /*!40101 SET character_set_client = @saved_cs_client */

Usage:
  python fix_schema.py                         # Fix schema_20260215_135628.sql (default)
  python fix_schema.py <file_path>             # Fix specified file
"""

from pathlib import Path
import re
import sys

# Get file path from argument or use default
if len(sys.argv) > 1:
    schema_file = Path(sys.argv[1])
else:
    schema_file = Path(__file__).parent / 'schema_20260215_135628.sql'

print(f"Fixing {schema_file}...")

if not schema_file.exists():
    print(f"Error: File not found: {schema_file}")
    sys.exit(1)

content = schema_file.read_text(encoding='utf-8')

# Remove problematic lines that try to restore @saved_cs_client
# Keep the lines that DEFINE @saved_cs_client
lines = content.split('\n')
fixed_lines = []

for i, line in enumerate(lines):
    # Skip the "restore" statements
    if '/*!40101 SET character_set_client = @saved_cs_client */' in line:
        continue

    # Keep the "save" statement and charset setting
    if '/*!40101 SET @saved_cs_client' in line or '/*!50503 SET character_set_client' in line:
        fixed_lines.append(line)
        continue

    # Add DROP TABLE before CREATE TABLE if not already there
    if line.strip().startswith('CREATE TABLE'):
        # Check if previous line is DROP TABLE
        if not any('DROP TABLE' in l for l in fixed_lines[-5:]):
            table_name = re.search(r'CREATE TABLE `(\w+)`', line)
            if table_name:
                drop_line = f"DROP TABLE IF EXISTS `{table_name.group(1)}`;"
                fixed_lines.append(drop_line)

    fixed_lines.append(line)

fixed_content = '\n'.join(fixed_lines)

schema_file.write_text(fixed_content, encoding='utf-8')
print(f"[OK] Schema file fixed: {schema_file}")
