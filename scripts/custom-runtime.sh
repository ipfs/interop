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
#  export IPFS_JS_MODULE=/tmp/js-ipfs/packages/ipfs/src/index.js
#  export IPFS_JS_HTTP_MODULE=/tmp/js-ipfs/packages/ipfs-http-client/src/index.js
#  export KUBO_RPC_MODULE=/tmp/kubo-rpc-client/src/index.js
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
            git checkout CHANGEME_GO
            make build
fi
fi

if [ "$IPFS_JS_EXEC" == /tmp/js-ipfs/packages/ipfs/src/cli.js ]; then
if [ ! -d /tmp/js-ipfs ]; then
    cd /tmp
        git clone https://github.com/ipfs/js-ipfs.git
        cd js-ipfs
            # set implementation to specific commit
            git checkout CHANGEME_JS
            npm install
            npm run build
            npm run link
fi
fi

cd $WORKDIR


# print overrides
env | grep IPFS_ || true
