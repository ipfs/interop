# ipfs-interop <!-- omit in toc -->

[![ipfs.io](https://img.shields.io/badge/project-IPFS-blue.svg?style=flat-square)](http://ipfs.io)
[![IRC](https://img.shields.io/badge/freenode-%23ipfs-blue.svg?style=flat-square)](http://webchat.freenode.net/?channels=%23ipfs)
[![Discord](https://img.shields.io/discord/806902334369824788?style=flat-square)](https://discord.gg/ipfs)
[![codecov](https://img.shields.io/codecov/c/github/ipfs/interop.svg?style=flat-square)](https://codecov.io/gh/ipfs/interop)
[![CI](https://img.shields.io/github/workflow/status/ipfs/interop/test%20&%20maybe%20release/master?style=flat-square)](https://github.com/ipfs/interop/actions/workflows/js-test-and-release.yml)

> Interoperability Tests for IPFS

## Table of contents <!-- omit in toc -->

- [Install](#install)
- [Usage](#usage)
  - [Run the tests](#run-the-tests)
  - [Run a particular test locally](#run-a-particular-test-locally)
- [Testing with different versions of go/js IPFS](#testing-with-different-versions-of-gojs-ipfs)
  - [As a project](#as-a-project)
  - [As environmental variables](#as-environmental-variables)
  - [As a custom runtime](#as-a-custom-runtime)
- [Releasing a new version](#releasing-a-new-version)
- [Interop release process for when breaking changes are introduced](#interop-release-process-for-when-breaking-changes-are-introduced)
- [License](#license)
- [Contribute](#contribute)

## Install

```console
$ npm i ipfs-interop
```

This repository will be used for interop tests. Please jump into the issues if you'd like to help out setting this up!

## Usage

### Run the tests

```console
$ ipfs-interop
```

### Run a particular test locally

```console
$ node bin/ipfs-interop.js -- -t node --grep {substring-test-name}
```

## Testing with different versions of go/js IPFS

### As a project

This module declares peer dependencies of `ipfs`, `ipfs-http-client`, `kubo-rpc-client` and `go-ipfs` so if you have `ipfs-interop` as a dependecy of your project, simply add the extra IPFS dependencies:

```json
{
  "name": "my-project",
  "scripts": {
    "interop": "ipfs-interop"
  },
  "dependencies": {
    "go-ipfs": "...",
    "ipfs": "...",
    "ipfs-http-client": "...",
    "ipfs-interop": "...",
    "kubo-rpc-client": "..."
  }
}
```

Then run:

```console
$ npm run interop
```

### As environmental variables

Specify the following environmental variables to control which versions of IPFS ipfs-interop uses when installed globally:

- `IPFS_GO_EXEC` A path to a go-IPFS binary
- `IPFS_JS_EXEC` A path to `/src/cli.js` inside a js-IPFS install
- `IPFS_JS_MODULE` A path to a js-IPFS install
- `IPFS_JS_HTTP_MODULE` A path to a ipfs-http-client install (optional)
- `KUBO_RPC_MODULE` A path to a kubo-rpc-client install (optional)

Then run:

```console
$ npm install -g ipfs-interop
$ IPFS_GO_EXEC=/path IPFS_JS_EXEC=/path IPFS_JS_MODULE=/path IPFS_JS_HTTP_MODULE=/path ipfs-interop
```

### As a custom runtime

If you want to run interop on CI against specific repo and git revision of
go-ipfs or js-ipfs\* then set everything up in `./scripts/custom-runtime.sh`
and enable it by uncommenting `env:` `IPFS_(..)` definitions in `.github/workflows/test.yml`

If you want to test against unrelased things locally, make sure the same env
variables are set on your machine.

For example, to run pubsub tests against go-ipfs and js-ipfs revision defined
in `./scripts/custom-runtime.sh`, one can:

    export IPFS_GO_EXEC=/tmp/go-ipfs/cmd/ipfs/ipfs
    export IPFS_JS_EXEC=/tmp/js-ipfs/packages/ipfs/src/cli.js
    export IPFS_JS_MODULE=/tmp/js-ipfs/packages/ipfs/src/index.js
    export IPFS_JS_HTTP_MODULE=/tmp/js-ipfs/packages/ipfs-http-client/src/index.js
    export KUBO_RPC_MODULE=/tmp/kubo-rpc-client/src/index.js
    ./scripts/custom-runtime.sh
    node bin/ipfs-interop.js -- -t node --grep "pubsub"

## Releasing a new version

This repo does not use aegir for releases.
Use `npm` directly  and publish entire root (CI in go-ipfs requires it).

    npm version [major|minor|patch]
    npm publish
    npm push origin && npm push origin v[N.N.N]

## Interop release process for when breaking changes are introduced

1. Get branches of go-ipfs and js-ipfs working together in interop locally using environment variables to point at the local versions
2. In this repo make a branch containing the interop changes as well as setting the go/js-ipfs commit hashes to be used by CI. Merge to master.
3. Update go-ipfs and js-ipfs branches to use interop/master instead of whatever is released
4. Release go and js-ipfs (not necessarily together) and after each is released (or RC'd) bump interop to use the release instead of the commit hash
5. Release interop
6. Bump go and js-ipfs to use released interop instead of master

## License

Licensed under either of

- Apache 2.0, ([LICENSE-APACHE](LICENSE-APACHE) / <http://www.apache.org/licenses/LICENSE-2.0>)
- MIT ([LICENSE-MIT](LICENSE-MIT) / <http://opensource.org/licenses/MIT>)

## Contribute

Feel free to join in. All welcome. Open an [issue](https://github.com/ipfs/js-ipfs-unixfs-importer/issues)!

This repository falls under the IPFS [Code of Conduct](https://github.com/ipfs/community/blob/master/code-of-conduct.md).

[![](https://cdn.rawgit.com/jbenet/contribute-ipfs-gif/master/img/contribute.gif)](https://github.com/ipfs/community/blob/master/CONTRIBUTING.md)
