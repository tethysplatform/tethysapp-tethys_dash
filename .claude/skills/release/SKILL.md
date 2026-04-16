---
name: release
description: Build npm, bump version in pyproject.toml, build Python package, and upload to PyPI
argument-hint: [major|minor|patch]
---

Release TethysDash to PyPI. Version increment type: $ARGUMENTS (default: patch if not provided).

Follow these steps exactly, in order:

1. **Determine increment type**: Use "$ARGUMENTS". If empty or not provided, default to `patch`. Only accept `major`, `minor`, or `patch` — if something else is given, stop and tell the user.

2. **Read current version**: Read `pyproject.toml` and find the line `version = "X.Y.Z"`. Parse the current version.

3. **Compute new version**:
   - `patch`: increment Z (e.g. 0.18.8 → 0.18.9)
   - `minor`: increment Y, reset Z to 0 (e.g. 0.18.8 → 0.19.0)
   - `major`: increment X, reset Y and Z to 0 (e.g. 0.18.8 → 1.0.0)

4. **Run npm build**: Run `npm run build` from the repo root. Stop if it fails.

5. **Update version in pyproject.toml**: Edit the `version = "..."` line in `pyproject.toml` to the new version.

6. **Run Python build**: Run `python -m build` from the repo root. Stop if it fails.

7. **Upload to PyPI**: Run `twine upload dist/tethysdash-<new_version>*` (glob with the new version). Stop if it fails.

8. **Report**: Tell the user the old version, new version, and confirm all steps completed successfully.
