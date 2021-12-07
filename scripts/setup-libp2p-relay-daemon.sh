#!/usr/bin/env bash

# This script ensures go-libp2p-relay-daemon is available
# for use in  circuit v1 and v2 tests.

set -eo pipefail

TAR=$(which tar)
if ! type sha512sum &> /dev/null; then
    # welcome to macOS and BSD versions of everything ;^)
    brew install coreutils
    brew install gnu-tar
    TAR=$(which gtar) # switch to GNU Tar
fi

download_dist_package () {
    local DIST_NAME="$1"
    local DIST_VERSION="$2"
    local DIST_FILE="${DIST_NAME}_${DIST_VERSION}_linux-amd64.tar.gz"
    local DIST_URL="https://dist.ipfs.io/${DIST_NAME}/${DIST_VERSION}/${DIST_FILE}"
    wget -nv -c --retry-connrefused --tries=0 --retry-on-host-error --retry-on-http-error=503,504,429 -O "${DIST_FILE}" "${DIST_URL}"
    wget -nv -c --retry-connrefused --tries=0 --retry-on-host-error --retry-on-http-error=503,504,429 -O "${DIST_FILE}.sha512" "${DIST_URL}.sha512"
    sha512sum -c "${DIST_FILE}.sha512"
}

if ! test -e ./scripts/libp2p-relay-daemon; then
    echo "Fetching ./scripts/libp2p-relay-daemon binary.."
    #GOBIN=$(realpath ./scripts) go install github.com/libp2p/go-libp2p-relay-daemon/cmd/libp2p-relay-daemon@v0.1.0
    VERSION="v0.1.0"
    download_dist_package libp2p-relay-daemon $VERSION
    $TAR vzx -f "libp2p-relay-daemon_${VERSION}_linux-amd64.tar.gz" -C ./scripts libp2p-relay-daemon/libp2p-relay-daemon --strip-components=1
    rm -f ./*_linux-amd64.tar.gz*
    echo "./scripts/libp2p-relay-daemon is ready"
fi
