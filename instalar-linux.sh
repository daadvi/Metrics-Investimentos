#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$HOME/.local/share/metrics-investimentos"
BIN="$HOME/.local/bin"
APPS="$HOME/.local/share/applications"
STAGE="$TARGET.staging.$$"
PREVIOUS="$TARGET.previous.$(date +%Y%m%d-%H%M%S)"
command -v node >/dev/null || { echo 'Instale Node.js 22.13+ para a versão leve Linux.'; exit 1; }
node -e 'const [a,b]=process.versions.node.split(".").map(Number);if(a<22||(a===22&&b<13))process.exit(1)' || { echo 'Node.js 22.13+ necessário.'; exit 1; }
if [ "$ROOT" = "$TARGET" ]; then echo 'Execute a partir da pasta fonte.'; exit 1; fi
if [ -e "$TARGET" ] && [ ! -f "$TARGET/server.mjs" ]; then echo 'Destino existente não reconhecido. Migração cancelada.'; exit 1; fi
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE" "$BIN" "$APPS"
cp -R "$ROOT/src" "$ROOT/web" "$STAGE/"
cp "$ROOT/server.mjs" "$ROOT/launcher.mjs" "$ROOT/package.json" "$STAGE/"
[ ! -f "$ROOT/README.md" ] || cp "$ROOT/README.md" "$STAGE/"
[ ! -f "$ROOT/LICENSE" ] || cp "$ROOT/LICENSE" "$STAGE/"
if [ -d "$ROOT/node_modules/pdfjs-dist" ]; then
 mkdir -p "$STAGE/node_modules"
 cp -R "$ROOT/node_modules/pdfjs-dist" "$STAGE/node_modules/"
else
 command -v npm >/dev/null || { echo 'npm indisponível e PDF.js não está instalado no código-fonte.'; exit 1; }
 (cd "$STAGE" && npm install --omit=dev --no-audit --no-fund --ignore-scripts)
fi
if [ -d "$TARGET" ]; then mv "$TARGET" "$PREVIOUS"; fi
if ! mv "$STAGE" "$TARGET"; then
 [ ! -d "$PREVIOUS" ] || mv "$PREVIOUS" "$TARGET"
 echo 'Falha na ativação. Pasta antiga preservada.'
 exit 1
fi
trap - EXIT
cat > "$BIN/metrics-investimentos" <<SH
#!/usr/bin/env bash
exec node "$TARGET/launcher.mjs"
SH
chmod +x "$BIN/metrics-investimentos"
cat > "$APPS/metrics-investimentos.desktop" <<SH
[Desktop Entry]
Type=Application
Name=Metrics Investimentos
Comment=Carteira local-first
Exec=$BIN/metrics-investimentos
Icon=$TARGET/web/logo.svg
Terminal=false
Categories=Office;Finance;
SH
chmod +x "$APPS/metrics-investimentos.desktop"
echo "Metrics Lite instalado em $TARGET"
if [ -d "$PREVIOUS" ]; then echo "Código anterior preservado em: $PREVIOUS"; fi
