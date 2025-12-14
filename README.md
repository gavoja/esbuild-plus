# esbuild-plus

Minimal zero-dependency esbuild development environment with live reload.

## Motivation

I absolutely love esbuild. And I am tired having to set it up over and over again for every project.

## Usage

Add to project:

```
npm i -D esbuild esbuild-plus
```

Run development server with auto reload. Serves target folder at http://localhost:3000:

```bash
npx ebp --dev
```

Bundle for production:

```bash
npx ebp
```

## Misc

### Working directory structure

The builder embraces convention over configuration philosophy. Set up the folder structure in your project accordingly:

```python
# Place all static files here.
# They will be recursively copied to target folder.
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

### Global `IS_DEV` variable

The `IS_DEV` global variable is available throughout all of your bundled scripts. It is set to `true` when running with `--dev` parameter. It could be useful to implement logic