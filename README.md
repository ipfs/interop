# Interoperability Tests for IPFS

[![](https://img.shields.io/badge/made%20by-Protocol%20Labs-blue.svg?style=flat-square)](http://ipn.io)
[![](https://img.shields.io/badge/project-IPFS-blue.svg?style=flat-square)](http://ipfs.io/)
[![](https://img.shields.io/badge/freenode-%23ipfs-blue.svg?style=flat-square)](http://webchat.freenode.net/?channels=%23ipfs)
[![standard-readme compliant](https://img.shields.io/badge/standard--readme-OK-green.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)
[![Travis CI](https://travis-ci.com/ipfs/interop.svg?branch=master)](https://travis-ci.com/ipfs/interop)

> Interoperability tests for IPFS Implementations

This repository will be used for interop tests. Please jump into the issues if you'd like to help out setting this up!

## Usage

### Install

```console
$ npm install -g ipfs-interop
```

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

This module declares peer dependencies of `ipfs`, `ipfs-http-client` and `go-ipfs` so if you have `ipfs-interop` as a dependecy of your project, simply add the extra IPFS dependencies:

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
    "ipfs-interop": "..."
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

Then run:

```console
$ npm install -g ipfs-interop
$ IPFS_GO_EXEC=/path IPFS_JS_EXEC=/path IPFS_JS_MODULE=/path IPFS_JS_HTTP_MODULE=/path ipfs-interop
```

### As a custom runtime

If you want to run interop on CI against specific repo and git revision of
go-ipfs or js-ipfs* then set everything up in `./scripts/custom-runtime.sh`
and enable it by uncommenting `env:` `IPFS_(..)` definitions in `.github/workflows/test.yml`

If you want to test against unrelased things locally, make sure the same env
variables are set on your machine.

For example, to run pubsub tests against go-ipfs and js-ipfs revision defined
in `./scripts/custom-runtime.sh`, one can:

```
export IPFS_GO_EXEC=/tmp/go-ipfs/cmd/ipfs/ipfs
export IPFS_JS_EXEC=/tmp/js-ipfs/packages/ipfs/src/cli.js
export IPFS_JS_MODULE=/tmp/js-ipfs/packages/ipfs/dist/cjs/src/index.js
export IPFS_JS_HTTP_MODULE=/tmp/js-ipfs/packages/ipfs-http-client/dist/cjs/src/index.js
./scripts/custom-runtime.sh
node bin/ipfs-interop.js -- -t node --grep "pubsub"
```

## Releasing a new version

This repo does not use aegir for releases.
Use `npm` directly  and publish entire root (CI in go-ipfs requires it).

```
npm version [major|minor|patch]
npm publish
npm push origin && npm push origin v[N.N.N]
```

## Interop release process for when breaking changes are introduced

1. Get branches of go-ipfs and js-ipfs working together in interop locally using environment variables to point at the local versions
2. In this repo make a branch containing the interop changes as well as setting the go/js-ipfs commit hashes to be used by CI. Merge to master.
3. Update go-ipfs and js-ipfs branches to use interop/master instead of whatever is released
4. Release go and js-ipfs (not necessarily together) and after each is released (or RC'd) bump interop to use the release instead of the commit hash
5. Release interop
6. Bump go and js-ipfs to use released interop instead of master

## Contribute

Feel free to join in. All welcome. Open an [issue](https://github.com/ipfs/ipfs-interop/issues)!

This repository falls under the IPFS [Code of Conduct](https://github.com/ipfs/community/blob/master/code-of-conduct.md).

[![](https://cdn.rawgit.com/jbenet/contribute-ipfs-gif/master/img/contribute.gif)](https://github.com/ipfs/community/blob/master/CONTRIBUTING.md)

## License

[MIT](./LICENSE)
