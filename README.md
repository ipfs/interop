# Interoperability Tests for IPFS

[![](https://img.shields.io/badge/made%20by-Protocol%20Labs-blue.svg?style=flat-square)](http://ipn.io)
[![](https://img.shields.io/badge/project-IPFS-blue.svg?style=flat-square)](http://ipfs.io/)
[![](https://img.shields.io/badge/freenode-%23ipfs-blue.svg?style=flat-square)](http://webchat.freenode.net/?channels=%23ipfs)
[![standard-readme compliant](https://img.shields.io/badge/standard--readme-OK-green.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)
[![circle](https://circleci.com/gh/ipfs/interop/tree/master.svg?style=svg)](https://circleci.com/gh/ipfs/interop/tree/master)
[![travis](https://travis-ci.org/ipfs/interop.svg?branch=port-tests)](https://travis-ci.org/ipfs/interop)
[![appveyor](https://ci.appveyor.com/api/projects/status/fvth3vq3h0rd9rf5/branch/master?svg=true)](https://ci.appveyor.com/project/wubalubadubdub/interop/branch/master)

> Interoperability tests for IPFS Implementations

This repository will be used for interop tests. Please jump into the issues if you'd like to help out setting this up!

## Usage

### Install

```
> git clone git@github.com:ipfs/interop.git
> cd interop
> npm install
```

### Run the tests

```
> npm test
```

### Test with a non yet released version of js-ipfs

```
# Do the steps in the install section, then
> cd ..
> git clone git@github.com:ipfs/js-ipfs.git
> cd js-ipfs
> npm install
> npm link
> cd ../interop
> npm link ipfs
> npm test
```

### Test with a non yet released version of go-ipfs

```
> Do the steps in the install section, then
> IPFS_EXEC=<path to the go-ipfs version you want to try> npm test
```

## Contribute

Feel free to join in. All welcome. Open an [issue](https://github.com/ipfs/ipfs-interop/issues)!

This repository falls under the IPFS [Code of Conduct](https://github.com/ipfs/community/blob/master/code-of-conduct.md).

[![](https://cdn.rawgit.com/jbenet/contribute-ipfs-gif/master/img/contribute.gif)](https://github.com/ipfs/community/blob/master/contributing.md)

## License

[MIT](./LICENSE)
