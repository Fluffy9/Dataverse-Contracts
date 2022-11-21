#!/bin/sh

echo ">> Building contract"

near-sdk-js build src/DVRegistry.ts build/DVRegistry.wasm
near-sdk-js build src/Scaffold.ts build/Scaffold.wasm
