## [9.1.0](https://github.com/ipfs/interop/compare/v9.0.3...v9.1.0) (2022-10-06)


### Features

* add kubo-rpc-client ([#499](https://github.com/ipfs/interop/issues/499)) ([d710daa](https://github.com/ipfs/interop/commit/d710daa4e8b2f5527db10e2231dd9574c0a2c6ce))

## [9.0.3](https://github.com/ipfs/interop/compare/v9.0.2...v9.0.3) (2022-10-04)


### Dependencies

* bump @multiformats/multiaddr from 11.0.0 to 11.0.3 ([#513](https://github.com/ipfs/interop/issues/513)) ([440d572](https://github.com/ipfs/interop/commit/440d5728634fdd798761081e5a46ac530e0a572e))
* bump aegir from 37.5.3 to 37.5.5 ([#514](https://github.com/ipfs/interop/issues/514)) ([ba73da4](https://github.com/ipfs/interop/commit/ba73da44da8b3075701fec385489c7b7d9f7c35d))
* **dev:** bump go-ipfs version to v0.16.0 ([#511](https://github.com/ipfs/interop/issues/511)) ([9a9e118](https://github.com/ipfs/interop/commit/9a9e118d8921af333c4b70fa92c6ff036494fa4a))

## [9.0.2](https://github.com/ipfs/interop/compare/v9.0.1...v9.0.2) (2022-09-29)


### Documentation

* remove duplicate contribute ([#508](https://github.com/ipfs/interop/issues/508)) ([57acdbf](https://github.com/ipfs/interop/commit/57acdbfe71a079abf7581edb9b89ee4399657999))

## [9.0.1](https://github.com/ipfs/interop/compare/v9.0.0...v9.0.1) (2022-09-22)


### Dependencies

* bump got from 12.4.1 to 12.5.0 ([#498](https://github.com/ipfs/interop/issues/498)) ([b20d5cf](https://github.com/ipfs/interop/commit/b20d5cfe22974306b23c6df6dafc8c532d435d12))
* update @multiformats/multiaddr to 11.0.0 ([#507](https://github.com/ipfs/interop/issues/507)) ([3baea6a](https://github.com/ipfs/interop/commit/3baea6a81324c124c1b5fd4f3f902bfc9a856817))

## [9.0.0](https://github.com/ipfs/interop/compare/v8.0.11...v9.0.0) (2022-09-17)


### ⚠ BREAKING CHANGES

* uses ESM release of ipfs/libp2p

### Features

* upgrade to esm libp2p/ipfs ([#462](https://github.com/ipfs/interop/issues/462)) ([b006606](https://github.com/ipfs/interop/commit/b006606a6d26673991dce94a558da40922e7b34c))


### Bug Fixes

* remove randomness from get directory tests ([#497](https://github.com/ipfs/interop/issues/497)) ([56f3370](https://github.com/ipfs/interop/commit/56f33706331fb95e98622d33143a17fec499e0b6))

### [8.0.11](https://github.com/ipfs/interop/compare/v8.0.10...v8.0.11) (2022-09-07)


### Bug Fixes

* use os.arch() when arch is undefined ([#488](https://github.com/ipfs/interop/issues/488)) ([f0cf7d8](https://github.com/ipfs/interop/commit/f0cf7d86469f9230ad6bd7d1a3e7bc884388e139)), closes [#487](https://github.com/ipfs/interop/issues/487)


### Trivial Changes

* Update .github/workflows/stale.yml [skip ci] ([2288d77](https://github.com/ipfs/interop/commit/2288d77ffae13ca8eff9c8ff385895746f750b77))

### [8.0.10](https://github.com/ipfs/interop/compare/v8.0.9...v8.0.10) (2022-04-19)


### Bug Fixes

* when hole punching is enabled by default ([#443](https://github.com/ipfs/interop/issues/443)) ([bda96fc](https://github.com/ipfs/interop/commit/bda96fc0080b692cda841305214fbf60f43070d2))

### [8.0.9](https://github.com/ipfs/interop/compare/v8.0.8...v8.0.9) (2022-04-04)


### Bug Fixes

* add fs and go-ipfs to browser ignores ([#451](https://github.com/ipfs/interop/issues/451)) ([3ade340](https://github.com/ipfs/interop/commit/3ade340b27db42e861a5f5c9bec1d0b64a6bf909))


### Trivial Changes

* add breaking change interop release process ([#395](https://github.com/ipfs/interop/issues/395)) ([119aa62](https://github.com/ipfs/interop/commit/119aa62172e107ebedcf9251c61a3fb360c6aed4))
* **deps:** bump aegir from 36.1.3 to 36.2.3 ([#445](https://github.com/ipfs/interop/issues/445)) ([18649a6](https://github.com/ipfs/interop/commit/18649a6b3168669258b6d0d2e493aa0400afa436))

### [8.0.8](https://github.com/ipfs/interop/compare/v8.0.7...v8.0.8) (2022-01-26)


### Bug Fixes

* add missing files ([e0736b4](https://github.com/ipfs/interop/commit/e0736b4299f9e814018cdb0fd8af00765afb1aac))

### [8.0.7](https://github.com/ipfs/interop/compare/v8.0.6...v8.0.7) (2022-01-26)


### Trivial Changes

* fix linting ([d6abdfd](https://github.com/ipfs/interop/commit/d6abdfdc7addc85551c2eff559d2281aab41b22b))
* release after build ([e434af2](https://github.com/ipfs/interop/commit/e434af2a5e031a621d64d5e75d076bb11f486639))

### [8.0.6](https://github.com/ipfs/interop/compare/v8.0.5...v8.0.6) (2022-01-26)


### Trivial Changes

* fix paths and packages ([8844f86](https://github.com/ipfs/interop/commit/8844f86f7dcca28597f96f6281324c26516237ea))

### [8.0.5](https://github.com/ipfs/interop/compare/v8.0.4...v8.0.5) (2022-01-26)


### Trivial Changes

* another esm module ([8558775](https://github.com/ipfs/interop/commit/8558775a8166e8ff4efda406c99deb865334f223))

### [8.0.4](https://github.com/ipfs/interop/compare/v8.0.3...v8.0.4) (2022-01-26)


### Bug Fixes

* copy bin dir during build ([e5b7d82](https://github.com/ipfs/interop/commit/e5b7d82e6fd257afb8751a613ce633df5d86cdac))

### [8.0.3](https://github.com/ipfs/interop/compare/v8.0.2...v8.0.3) (2022-01-26)


### Bug Fixes

* need type module to load js as module ([ceb5d5e](https://github.com/ipfs/interop/commit/ceb5d5e663b2b282d89fa41191bb6b05edd011df))

### [8.0.2](https://github.com/ipfs/interop/compare/v8.0.1...v8.0.2) (2022-01-26)


### Bug Fixes

* include scripts in dist ([fcc706e](https://github.com/ipfs/interop/commit/fcc706ed1f5112fa26de4618b244ab499db9a9d3))


### Trivial Changes

* run release after build ([b2e7630](https://github.com/ipfs/interop/commit/b2e7630c5ca0681db1f661240bb8b1dbb0363e35))
* update build ([f4c783a](https://github.com/ipfs/interop/commit/f4c783a383ac353ae64253e7684a4cf15a880c65))

### [8.0.1](https://github.com/ipfs/interop/compare/v8.0.0...v8.0.1) (2022-01-26)


### Bug Fixes

* disable js dht during circuit tests ([#430](https://github.com/ipfs/interop/issues/430)) ([8a1bbd5](https://github.com/ipfs/interop/commit/8a1bbd5d26dcf568eed7c67c519e2a874c571906))


### Trivial Changes

* add auto-release ([b7fff84](https://github.com/ipfs/interop/commit/b7fff8485171db0785a2584bf7e65a69424a55ff))
* restore ci tests on default branch ([#424](https://github.com/ipfs/interop/issues/424)) ([037f902](https://github.com/ipfs/interop/commit/037f902d815421ca3e03aadcfa6586846bb5d399)), closes [#409](https://github.com/ipfs/interop/issues/409)
* update build config ([bd8767c](https://github.com/ipfs/interop/commit/bd8767c16e6489bff6e08a6c05b8fe7a45ab718d))
* update lockfile ([0b6289a](https://github.com/ipfs/interop/commit/0b6289ab94a79c44738b9a225e8f0c7a0bbf7a1c))

### [8.0.1](https://github.com/ipfs/interop/compare/v8.0.0...v8.0.1) (2022-01-26)


### Bug Fixes

* disable js dht during circuit tests ([#430](https://github.com/ipfs/interop/issues/430)) ([8a1bbd5](https://github.com/ipfs/interop/commit/8a1bbd5d26dcf568eed7c67c519e2a874c571906))


### Trivial Changes

* add auto-release ([b7fff84](https://github.com/ipfs/interop/commit/b7fff8485171db0785a2584bf7e65a69424a55ff))
* do not use readable streams for input ([4ea14c5](https://github.com/ipfs/interop/commit/4ea14c513b270275e4d0b189be829e7b630bf12d))
* restore ci tests on default branch ([#424](https://github.com/ipfs/interop/issues/424)) ([037f902](https://github.com/ipfs/interop/commit/037f902d815421ca3e03aadcfa6586846bb5d399)), closes [#409](https://github.com/ipfs/interop/issues/409)
* update lockfile ([4d627a3](https://github.com/ipfs/interop/commit/4d627a3485ca8a046e6f5021bd42d2d1a48b0dac))
* update lockfile ([0b6289a](https://github.com/ipfs/interop/commit/0b6289ab94a79c44738b9a225e8f0c7a0bbf7a1c))

## [7.0.4](https://github.com/ipfs/interop/compare/v7.0.3...v7.0.4) (2021-10-25)


### Bug Fixes

* disable pubsub due to wire format changes ([#388](https://github.com/ipfs/interop/issues/388)) ([344f692](https://github.com/ipfs/interop/commit/344f692d8cdc68fabe424814214dfb43c716edac))



<a name="2.0.1"></a>
## [2.0.1](https://github.com/ipfs/interop/compare/v2.0.0...v2.0.1) (2020-07-30)


### Bug Fixes

* tests for new IPNS name formatting ([#141](https://github.com/ipfs/interop/issues/141)) ([6821a5d](https://github.com/ipfs/interop/commit/6821a5d))



<a name="2.0.0"></a>
# [2.0.0](https://github.com/ipfs/interop/compare/v1.0.4...v2.0.0) (2020-07-16)



<a name="1.0.4"></a>
## [1.0.4](https://github.com/ipfs/interop/compare/v1.0.3...v1.0.4) (2020-05-26)


### Bug Fixes

* go-ipfs 0.5 sync ([#113](https://github.com/ipfs/interop/issues/113)) ([df79b59](https://github.com/ipfs/interop/commit/df79b59))



<a name="1.0.3"></a>
## [1.0.3](https://github.com/ipfs/interop/compare/v1.0.2...v1.0.3) (2020-05-14)


### Bug Fixes

* override ipfs module location ([#111](https://github.com/ipfs/interop/issues/111)) ([e0a6f71](https://github.com/ipfs/interop/commit/e0a6f71))



<a name="1.0.2"></a>
## [1.0.2](https://github.com/ipfs/interop/compare/v1.0.1...v1.0.2) (2020-05-09)


### Bug Fixes

* **ci:** add empty commit to fix lint checks on master ([4e43e6a](https://github.com/ipfs/interop/commit/4e43e6a))



<a name="1.0.1"></a>
## [1.0.1](https://github.com/ipfs/interop/compare/v1.0.0...v1.0.1) (2020-04-20)


### Bug Fixes

* all repo compatibility tests ([#109](https://github.com/ipfs/interop/issues/109)) ([edfaa09](https://github.com/ipfs/interop/commit/edfaa09))
* fix name-pubsub test ([#108](https://github.com/ipfs/interop/issues/108)) ([1a33bf9](https://github.com/ipfs/interop/commit/1a33bf9))



<a name="1.0.0"></a>
# [1.0.0](https://github.com/ipfs/interop/compare/v0.2.1...v1.0.0) (2020-02-13)



<a name="0.2.1"></a>
## [0.2.1](https://github.com/ipfs/interop/compare/v0.2.0...v0.2.1) (2019-12-24)


### Bug Fixes

* pass args for multiple http-client versions ([b53635d](https://github.com/ipfs/interop/commit/b53635d))



<a name="0.2.0"></a>
# [0.2.0](https://github.com/ipfs/interop/compare/v0.1.1...v0.2.0) (2019-12-23)


### Bug Fixes

* **ipns:** fix allowOffline flag ([83fcbff](https://github.com/ipfs/interop/commit/83fcbff))
* add back the lockfile ([f5c6706](https://github.com/ipfs/interop/commit/f5c6706))



<a name="0.1.1"></a>
## [0.1.1](https://github.com/ipfs/interop/compare/v0.1.0...v0.1.1) (2019-10-08)


### Bug Fixes

* fix up pubsub tests ([e2222be](https://github.com/ipfs/interop/commit/e2222be))
* linting ([aa2e50b](https://github.com/ipfs/interop/commit/aa2e50b))



<a name="0.1.0"></a>
# [0.1.0](https://github.com/ipfs/interop/compare/41ee565...v0.1.0) (2019-09-12)


### Bug Fixes

* daemon type in tests ([#18](https://github.com/ipfs/interop/issues/18)) ([2fbde7b](https://github.com/ipfs/interop/commit/2fbde7b))
* enable browser-browser-go circuit test ([#64](https://github.com/ipfs/interop/issues/64)) ([eaffbcf](https://github.com/ipfs/interop/commit/eaffbcf))
* files and pubsub ci ([#37](https://github.com/ipfs/interop/issues/37)) ([b271ea8](https://github.com/ipfs/interop/commit/b271ea8))
* interop dial blacklist ([8a362c6](https://github.com/ipfs/interop/commit/8a362c6))
* ipns pubsub race condition ([6a04d95](https://github.com/ipfs/interop/commit/6a04d95))
* pubsub tests ([#66](https://github.com/ipfs/interop/issues/66)) ([7576947](https://github.com/ipfs/interop/commit/7576947))
* quarantine exchange files tests ([97a4749](https://github.com/ipfs/interop/commit/97a4749))
* removed skip test ([b4138b7](https://github.com/ipfs/interop/commit/b4138b7))
* repo interop ([79b7182](https://github.com/ipfs/interop/commit/79b7182))
* temporarily quarantine pubsub tests ([e8adb4f](https://github.com/ipfs/interop/commit/e8adb4f))


### Features

* add executable file ([62734d6](https://github.com/ipfs/interop/commit/62734d6))
* add jenkins ci ([#7](https://github.com/ipfs/interop/issues/7)) ([10bb4cd](https://github.com/ipfs/interop/commit/10bb4cd))
* js-ipfs 0.33.0 and go-ipfs 0.4.18 ([4085089](https://github.com/ipfs/interop/commit/4085089))
* port to new ipfsd-ctl ([#5](https://github.com/ipfs/interop/issues/5)) ([41ee565](https://github.com/ipfs/interop/commit/41ee565))
* test against go-ipfs 0.4.20 ([#65](https://github.com/ipfs/interop/issues/65)) ([24cf14a](https://github.com/ipfs/interop/commit/24cf14a))
* test against js-ipfs 0.35 ([#60](https://github.com/ipfs/interop/issues/60)) ([f42567e](https://github.com/ipfs/interop/commit/f42567e))
* test with new IPFS ([47ca31b](https://github.com/ipfs/interop/commit/47ca31b))
* use smaller keysize ([#14](https://github.com/ipfs/interop/issues/14)) ([9241cc7](https://github.com/ipfs/interop/commit/9241cc7))
