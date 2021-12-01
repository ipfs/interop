#!/usr/bin/env bash

# This script ensures go-libp2p-relay-daemon is available
# for use in  circuit v1 and v2 tests.

set -eo pipefail

if ! test -e ./scripts/libp2p-relay-daemon; then
    echo "Fetching ./scripts/libp2p-relay-daemon binary.."
    GOBIN=$(realpath ./scripts) go install github.com/libp2p/go-libp2p-relay-daemon/cmd/libp2p-relay-daemon@v0.1.0
    echo "./scripts/libp2p-relay-daemon is ready"
fi
