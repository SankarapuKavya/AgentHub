"""
repo_parser.py — Parse LLM output into real files (no intermediate zip).

The LLM outputs files using this format:
    ### FILE: path/to/file.ext
    ```lang
    <file content>
    ```

write_repo() writes individual files to run_dir/project_name/
and returns the project directory + list of written paths.
"""

import re, shutil
from pathlib import Path


def is_repo_output(text: str) -> bool:
    if re.search(r'###\s*FILE:', text, re.I):
        return True
    # At least 2 named fenced blocks
    fences = re.findall(r'```[\w./\-_]+\n', text)
    if len(fences) >= 2:
        return True
    return False


def parse_repo(text: str) -> list:
    """
    Returns list of {"path": str, "content": str}.
    Tries multiple patterns, most reliable first.
    """
    files = []
    seen = set()

    # ── Pattern 1: ### FILE: path\n```lang\ncontent\n``` (PRIMARY)
    # Use a two-pass approach: first find all ### FILE: markers and their positions
    marker_re = re.compile(r'###\s*FILE:\s*(.+?)\s*\n', re.I)
    fence_close_re = re.compile(r'^```\s*$', re.MULTILINE)

    markers = list(marker_re.finditer(text))
    if markers:
        for i, m in enumerate(markers):
            path = m.group(1).strip().lstrip('/').lstrip('./')
            if not path or path in seen:
                continue

            # Content starts after the marker line (and optional opening fence)
            start = m.end()
            # Skip optional opening fence like ```java or ```python
            fence_open = re.match(r'```[^\n]*\n', text[start:])
            if fence_open:
                content_start = start + fence_open.end()
            else:
                content_start = start

            # Content ends at closing ``` OR at next ### FILE: marker
            next_marker_pos = markers[i+1].start() if i+1 < len(markers) else len(text)

            # Find closing fence ``` within the range up to next marker
            content_chunk = text[content_start:next_marker_pos]
            close_match = fence_close_re.search(content_chunk)
            if close_match:
                content = content_chunk[:close_match.start()].rstrip('\n')
            else:
                # No closing fence — take all content up to next marker, strip trailing ```
                content = content_chunk.rstrip()
                if content.endswith('```'):
                    content = content[:-3].rstrip()

            if content.strip():
                seen.add(path)
                files.append({"path": path, "content": content})

    if files:
        return files

    # ── Pattern 2: // File: path or # File: path
    comment_re = re.compile(
        r'^(?://|#)\s*[Ff]ile:\s*(.+?)\s*\n'
        r'(?:```[^\n]*\n)?'
        r'([\s\S]*?)'
        r'(?:```\s*\n|(?=^(?://|#)\s*[Ff]ile:)|\Z)',
        re.MULTILINE
    )
    for match in comment_re.finditer(text):
        path = match.group(1).strip().lstrip('/').lstrip('./')
        content = match.group(2).rstrip('\n')
        if path and path not in seen and content.strip():
            seen.add(path)
            files.append({"path": path, "content": content})

    if files:
        return files

    # ── Pattern 3: named fenced blocks  ```python src/main.py
    named_fence_re = re.compile(r'```\w*\s+([\w./\-_]+\.[\w]+)\n([\s\S]*?)```', re.MULTILINE)
    for match in named_fence_re.finditer(text):
        path = match.group(1).strip()
        content = match.group(2).rstrip('\n')
        if path not in seen and content.strip():
            seen.add(path)
            files.append({"path": path, "content": content})

    return files


def write_repo(files: list, root_dir: Path, project_name: str = "project") -> tuple:
    """
    Write parsed files to root_dir/project_name/.
    Returns (proj_dir, list_of_written_file_paths).
    NO ZIP — caller handles bundling.
    """
    proj_dir = root_dir / project_name
    if proj_dir.exists():
        shutil.rmtree(proj_dir)
    proj_dir.mkdir(parents=True)

    written_paths = []
    for f in files:
        # Sanitize path
        parts = [p for p in Path(f["path"]).parts if p not in ('', '.', '..')]
        if not parts:
            continue
        file_path = proj_dir.joinpath(*parts)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(f["content"], encoding="utf-8", errors="replace")
        written_paths.append(file_path)

    return proj_dir, written_paths


def build_tree(files: list) -> str:
    paths = sorted(f["path"] for f in files)
    dirs = {}
    for p in paths:
        parts = Path(p).parts
        node = dirs
        for part in parts[:-1]:
            node = node.setdefault(part + '/', {})
        node[parts[-1]] = None

    lines = []
    def walk(node, prefix=""):
        items = list(node.items())
        for i, (name, children) in enumerate(items):
            is_last = i == len(items) - 1
            connector = "└── " if is_last else "├── "
            lines.append(prefix + connector + name)
            if children:
                extension = "    " if is_last else "│   "
                walk(children, prefix + extension)
    walk(dirs)
    return "\n".join(lines)


REPO_SYSTEM_ADDENDUM = """

CRITICAL: When generating code projects, you MUST output EVERY file in this EXACT format:

### FILE: path/to/filename.ext
```language
<COMPLETE file content — never truncate, never use "// ... rest of code">
```

RULES:
1. Use relative paths (no leading / or ../)
2. Output COMPLETE file content — every line, no shortcuts, no placeholders
3. Include ALL files: source, config, README.md, dependencies (requirements.txt / package.json / pom.xml etc.)
4. Do NOT write "// ... implementation" or "# rest of code" — write the ACTUAL code
5. Separate each file with a blank line before the next ### FILE: marker

Example:
### FILE: src/main.py
```python
def main():
    print("Hello World")

if __name__ == "__main__":
    main()
```

### FILE: requirements.txt
```
flask>=3.0.0
```
"""
