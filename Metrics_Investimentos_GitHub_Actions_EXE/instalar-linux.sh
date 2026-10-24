#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
TARGET="$HOME/.local/share/metrics-investimentos"
BIN="$HOME/.local/bin"
APPS="$HOME/.local/share/applications"
mkdir -p "$TARGET" "$BIN" "$APPS"
cp -R "$ROOT/src" "$ROOT/web" "$ROOT/docs" "$ROOT/test" "$TARGET/"
cp "$ROOT/server.mjs" "$ROOT/package.json" "$ROOT/README.md" "$ROOT/metrics-desktop-linux.sh" "$ROOT/launcher.mjs" "$TARGET/"
chmod +x "$TARGET/metrics-desktop-linux.sh"
cat > "$BIN/metrics-investimentos" <<EOX
#!/usr/bin/env bash
exec "$TARGET/metrics-desktop-linux.sh"
EOX
chmod +x "$BIN/metrics-investimentos"
cat > "$APPS/metrics-investimentos.desktop" <<EOX
[Desktop Entry]
Type=Application
Name=Metrics Investimentos
Comment=Gestão local de investimentos com IA híbrida
Exec=$BIN/metrics-investimentos
Icon=$TARGET/web/logo.svg
Terminal=false
Categories=Office;Finance;
StartupWMClass=Metrics Investimentos
EOX
chmod +x "$APPS/metrics-investimentos.desktop"
echo "Metrics instalado em $TARGET"
echo "Abra pelo menu de aplicativos ou execute: $BIN/metrics-investimentos"
echo 'Se o lançador não aparecer imediatamente, encerre e reinicie a sessão gráfica.'
