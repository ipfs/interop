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

### As environmental variables

Specify the following environmental variables to control which versions of IPFS ipfs-interop uses when installed globally:

- `IPFS_GO_EXEC` A path to a go-IPFS binary
- `IPFS_JS_EXEC` A path to `/src/cli/bin.js` inside a js-IPFS install
- `IPFS_JS_MODULE` A path to a js-IPFS install
- `IPFS_JS_HTTP_MODULE` A path to a ipfs-http-client install (optional)

Then run:

```console
$ npm install -g ipfs-interop
$ IPFS_GO_EXEC=/path IPFS_JS_EXEC=/path IPFS_JS_MODULE=/path IPFS_JS_HTTP_MODULE=/path ipfs-interop
```

## Contribute

Feel free to join in. All welcome. Open an [issue](https://github.com/ipfs/ipfs-interop/issues)!

This repository falls under the IPFS [Code of Conduct](https://github.com/ipfs/community/blob/master/code-of-conduct.md).

[![](https://cdn.rawgit.com/jbenet/contribute-ipfs-gif/master/img/contribute.gif)](https://github.com/ipfs/community/blob/master/CONTRIBUTING.md)

## License

[MIT](./LICENSE)
