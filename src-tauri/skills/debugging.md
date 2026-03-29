# Debugging

**Category:** core

## Overview

Python debugging techniques and strategies for efficient problem solving.

## Techniques

- Use `breakpoint()` (Python 3.7+) to drop into the debugger at any point
- `pdb` commands: `n` (next), `s` (step into), `c` (continue), `p expr` (print)
- Add `print(repr(value))` for quick inspection -- `repr` shows type info
- Use `traceback.print_exc()` in except blocks to see full stack traces
- `logging` module is better than print for production debugging

## Common Issues

- `TypeError`: Check argument types and count -- use `type()` to verify
- `AttributeError`: Verify object type, check for None values
- `ImportError`: Verify module is installed and path is correct
- `KeyError`: Use `.get(key, default)` for safe dictionary access
- `IndentationError`: Ensure consistent use of spaces (4 per level)

## Tools

- `python -m pdb script.py` -- run script under debugger
- `python -i script.py` -- drop into REPL after script runs
- `vars(obj)` -- inspect all attributes of an object
