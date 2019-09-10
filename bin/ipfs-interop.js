#!/usr/bin/env node

'use strict'

const { spawn } = require('child_process')

const proc = spawn('npm', ['test'], {
  cwd: __dirname
})
proc.stdout.pipe(process.stdout)
proc.stderr.pipe(process.stderr)

proc.on('close', (code) => {
  if (code !== 0) {
    throw new Error(`Child process exited with code ${code}`)
  }
})
