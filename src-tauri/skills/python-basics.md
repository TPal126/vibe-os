# Python Basics

**Category:** core

## Overview

Core Python coding patterns and best practices for everyday development.

## Key Patterns

- Use list comprehensions for concise filtering and transformation
- Prefer `pathlib.Path` over `os.path` for file system operations
- Use `with` statements for resource management (files, connections)
- Type hints improve code clarity: `def greet(name: str) -> str:`
- F-strings are the preferred way to format strings: `f"Hello {name}"`

## Common Idioms

- Unpack tuples: `first, *rest = items`
- Dictionary merging: `merged = {**dict_a, **dict_b}`
- Conditional expressions: `value = x if condition else y`
- Enumerate for index+value: `for i, item in enumerate(items):`
- Use `dataclasses` for structured data instead of plain dicts
