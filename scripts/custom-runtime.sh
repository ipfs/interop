#!/usr/bin/env bash

# This script  sets up the Rube Goldberg machine for testing against custom
# revision of go-ipfs and js-ipfs (the latter being tricky due to lerna monorepo)
#
# It assumes IPFS_GO_EXEC or IPFS_JS_EXEC to be in env.
# One can trigger this locally by exporting the same path as we do on CI.
# For example, to run pubsub tests against go-ipfs and js-ipfs revision defined
# in ./scripts/custom-runtime.sh one can:
#
#  export IPFS_GO_EXEC=/tmp/go-ipfs/cmd/ipfs/ipfs
#  export IPFS_JS_EXEC=/tmp/js-ipfs/packages/ipfs/src/cli.js
#  export IPFS_JS_MODULE=/tmp/js-ipfs/packages/ipfs/dist/cjs/src/index.js
#  export IPFS_JS_HTTP_MODULE=/tmp/js-ipfs/packages/ipfs-http-client/dist/cjs/src/index.js
#  ./scripts/custom-runtime.sh
#  node bin/ipfs-interop.js -- -t node --grep "pubsub"

set -eo pipefail

WORKDIR=$(pwd)

if [ "$IPFS_GO_EXEC" == /tmp/go-ipfs/cmd/ipfs/ipfs ]; then
if [ ! -d /tmp/go-ipfs ]; then
    cd /tmp
        git clone https://github.com/ipfs/go-ipfs.git
        cd go-ipfs
            # set implementation to specific commit
            git switch master # , lets roll with master until go-ipfs 0.11.0-rc1
            make build
fi
fi

if [ "$IPFS_JS_EXEC" == /tmp/js-ipfs/packages/ipfs/src/cli.js ]; then
if [ ! -d /tmp/js-ipfs ]; then
    cd /tmp
        git clone https://github.com/ipfs/js-ipfs.git
        cd js-ipfs
            # implementation from https://github.com/ipfs/js-ipfs/pull/3922
            git checkout a536257a6b912edc16d12d34eac4c9ef49d4cf22
            npm install
            npm run build
            npm run link
fi
fi

cd $WORKDIR


# print overrides
env | grep IPFS_ || true
