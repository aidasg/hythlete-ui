#!/usr/bin/env bash
set -euo pipefail

SPEC_PATH="${OPENAPI_SPEC_PATH:-../hythlete-be/docs/openapiv3.json}"
OUTPUT_PATH="${OPENAPI_OUTPUT_PATH:-src/services/api/generated/schema.ts}"

mkdir -p "$(dirname "$OUTPUT_PATH")"

npx openapi-typescript "$SPEC_PATH" -o "$OUTPUT_PATH"
