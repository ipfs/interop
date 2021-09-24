#!/usr/bin/env node

import { spawn } from 'child_process'

const proc = spawn('npm', ['test'].concat(process.argv.slice(2)), {
  cwd: __dirname
})
proc.stdout.pipe(process.stdout)
proc.stderr.pipe(process.stderr)

proc.on('close', (code) => {
  if (code !== 0) {
    throw new Error(`Child process exited with code ${code}`)
  }
})
