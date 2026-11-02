#!/bin/sh
set -eu
cd "$(dirname "$0")"
SOURCE="$(pwd)/codigo"
if [ -f ../server.mjs ]; then SOURCE="$(cd .. && pwd)"; fi
if [ ! -f "$SOURCE/server.mjs" ]; then node preparar-pasta.mjs; fi
PORT=4173 node "$SOURCE/launcher.mjs"
