#!/usr/bin/env python3
"""
Split MySQL dump file into schema and data files.
- schema file: CREATE TABLE statements only
- data file: LOCK TABLES, INSERT, UNLOCK TABLES only
"""

import re
from pathlib import Path

def extract_header_and_footer(content):
    """Extract header and footer from SQL content."""
    lines = content.split('\n')

    # Find header end: first DROP TABLE line
    header_end = 0
    for i, line in enumerate(lines):
        if line.strip().startswith('DROP TABLE IF EXISTS'):
            header_end = i
            break

    # Header includes everything up to (but not including) first DROP TABLE
    # and should end with empty line
    while header_end > 0 and lines[header_end - 1].strip() == '':
        header_end -= 1

    header = '\n'.join(lines[:header_end]) + '\n'

    # Find footer start: first /*!40101 SET CHARACTER_SET_RESULTS
    footer_start = len(lines)
    for i in range(len(lines) - 1, -1, -1):
        if '/*!40101 SET CHARACTER_SET_RESULTS' in lines[i]:
            footer_start = i
            break

    footer = '\n'.join(lines[footer_start:])

    # Body is everything between header and footer
    body = '\n'.join(lines[header_end:footer_start])

    return header, body, footer


def split_sql_blocks(body):
    """Split body into schema and data blocks."""
    schema_blocks = []
    data_blocks = []

    # Split by DROP TABLE pattern
    # Pattern: DROP TABLE IF EXISTS `table_name`;
    drop_pattern = re.compile(r'^DROP TABLE IF EXISTS .+?;$', re.MULTILINE)

    # Find all DROP TABLE positions
    drop_matches = list(drop_pattern.finditer(body))

    if not drop_matches:
        print("Warning: No DROP TABLE statements found")
        return schema_blocks, data_blocks

    # For each section between DROP and next DROP (or end)
    for idx, match in enumerate(drop_matches):
        drop_end = match.end()
        next_drop_start = drop_matches[idx + 1].start() if idx + 1 < len(drop_matches) else len(body)

        # Extract the section after DROP TABLE (skip newlines after DROP)
        section = body[drop_end:next_drop_start]

        # Skip leading newlines
        section = section.lstrip('\n')

        # Extract CREATE TABLE block (from CREATE to next LOCK TABLES)
        create_match = re.search(r'^CREATE TABLE .+?^(?=LOCK TABLES)', section, re.MULTILINE | re.DOTALL)
        if create_match:
            create_block = create_match.group(0).rstrip()
            # Ensure it ends with ;
            if not create_block.endswith(';'):
                create_block += ';'
            schema_blocks.append(create_block + '\n')

        # Extract LOCK...UNLOCK block (from LOCK TABLES to UNLOCK TABLES;)
        lock_match = re.search(r'^LOCK TABLES .+?^UNLOCK TABLES;$', section, re.MULTILINE | re.DOTALL)
        if lock_match:
            lock_block = lock_match.group(0)
            data_blocks.append(lock_block + '\n')

    return schema_blocks, data_blocks


def main():
    import sys

    # Get file path from argument or use default
    if len(sys.argv) > 1:
        sql_file = Path(sys.argv[1])
    else:
        sql_file = Path(__file__).parent / 'first_release_20260215_135628.sql'

    if not sql_file.exists():
        print(f"Error: File not found: {sql_file}")
        sys.exit(1)

    print(f"Reading {sql_file}...")
    content = sql_file.read_text(encoding='utf-8')

    print("Extracting header and footer...")
    header, body, footer = extract_header_and_footer(content)

    print("Splitting into schema and data blocks...")
    schema_blocks, data_blocks = split_sql_blocks(body)

    print(f"  Found {len(schema_blocks)} schema blocks")
    print(f"  Found {len(data_blocks)} data blocks")

    # Generate output file paths based on input filename
    stem = sql_file.stem
    suffix = sql_file.suffix

    # Replace common prefixes to generate consistent names
    if 'record_only_init' in stem:
        base_name = stem.replace('record_only_init_', '')
    elif 'mobile_init' in stem:
        base_name = stem.replace('mobile_init_', '')
    else:
        base_name = stem

    schema_file = sql_file.parent / f'schema_{base_name}{suffix}'
    data_file = sql_file.parent / f'data_{base_name}{suffix}'

    schema_content = header + '\n'.join(schema_blocks) + '\n' + footer
    print(f"\nWriting {schema_file}...")
    schema_file.write_text(schema_content, encoding='utf-8')

    data_content = header + '\n'.join(data_blocks) + '\n' + footer
    print(f"Writing {data_file}...")
    data_file.write_text(data_content, encoding='utf-8')

    print("\nDone!")
    print(f"Schema file: {len(schema_content)} bytes")
    print(f"Data file: {len(data_content)} bytes")


if __name__ == '__main__':
    main()
