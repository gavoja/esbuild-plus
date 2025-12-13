# esbuild-plus

Minimal zero-dependency esbuild development environment with live reload.

## Motivation

I absolutely love esbuild. And I am tired having to set up it over and over again for every project.

## Usage

Add to project:
```
npm i -D esbuild esbuild-plus
```

Run development server with auto reload:
```bash
npx ebp --dev
```

Bundle for production:
```bash
npx ebp
```

## Working directory structure

```python
# Place all static files here.
# They will be recursively copied to target.
static/
├─ index.html
├─ styles.css
└─ ...

# Main source folder with main entry point.
# Supports JSX and TSX as well.
src/
└─ main.js

# Contains bundled output and copied static files.
# This is the root of the HTTP server.
target/
├─ index.html
├─ main.js
├─ styles.css
└─ ...

package.json
```
