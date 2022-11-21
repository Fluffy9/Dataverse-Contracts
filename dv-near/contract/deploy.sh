#!/bin/sh

./build.sh

if [ $? -ne 0 ]; then
  echo ">> Error building contract"
  exit 1
fi

echo ">> Deploying contract"

# https://docs.near.org/tools/near-cli#near-dev-deploy
near deploy --accountId dv-registry --wasmFile build/DVRegistry.wasm
# near dev-deploy --wasmFile build/DVRegistry.wasm
# near dev-deploy --wasmFile build/Scaffold.wasm