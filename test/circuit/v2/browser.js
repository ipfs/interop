/* eslint max-nested-callbacks: ["error", 8] */
/* eslint-env mocha */

// TODO when we have circuit v2 in js-ipfs and webrtc signaling
export default {
  'browser-go-js': {
    skip: () => true
  },
  'browser-go-go': {
    skip: () => true
  },
  'browser-js-js': {
    skip: () => true
  },
  'browser-js-go': {
    skip: () => true
  },
  'js-go-browser': {
    skip: () => true
  },
  'go-go-browser': {
    skip: () => true
  },
  'js-js-browser': {
    skip: () => true
  },
  'go-js-browser': {
    skip: () => true
  },
  'go-browser-browser': {
    skip: () => true
  },
  'js-browser-browser': {
    skip: () => true
  },
  'browser-browser-go': {
    skip: () => true
  },
  'browser-browser-js': {
    skip: () => true
  }
}
