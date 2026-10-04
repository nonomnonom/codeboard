#!/bin/sh
set -eu

fail() { printf '%s\n' "Codeboard: $*" >&2; exit 1; }
version=''
prefix=''
modify_path=1
while [ "$#" -gt 0 ]; do
  case "$1" in
    --version) [ "$#" -ge 2 ] || fail '--version needs a release number'; version=$2; shift 2 ;;
    --prefix) [ "$#" -ge 2 ] || fail '--prefix needs an absolute directory'; prefix=$2; shift 2 ;;
    --no-modify-path) modify_path=0; shift ;;
    *) fail "Unknown argument: $1. Usage: sh install.sh [--version VERSION] [--prefix DIRECTORY] [--no-modify-path]" ;;
  esac
done
for tool in curl tar mktemp; do command -v "$tool" >/dev/null || fail "$tool is required"; done
case "$(uname -s):$(uname -m)" in
  Linux:x86_64) platform=linux-x64 ;;
  Darwin:arm64) platform=macos-arm64 ;;
  Darwin:x86_64) platform=macos-x64 ;;
  *) fail 'Supported systems: Linux x64 (glibc), macOS arm64 and macOS x64.' ;;
esac
repo=https://github.com/nonomnonom/codeboard
if [ -z "$version" ]; then
  release=$(curl --proto '=https' --proto-redir '=https' -fsSL -o /dev/null -w '%{url_effective}' "$repo/releases/latest")
  version=${release##*/}
fi
version=${version#v}
printf '%s\n' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.-]+)?$' || fail 'Invalid release number'
root="$HOME/.local/share/codeboard"
bin="$HOME/.local/bin"
if [ -n "$prefix" ]; then
  case "$prefix" in /*) root=$prefix; bin="$prefix/bin" ;; *) fail '--prefix must be an absolute path' ;; esac
  [ "$modify_path" -eq 0 ] || fail 'Use --no-modify-path with --prefix, then add its bin directory to PATH yourself.'
fi
target="$root/versions/$version"
mkdir -p "$root/versions" "$bin"
mkdir "$root/.install-lock" 2>/dev/null || fail "Another installer is running. If it was interrupted, remove $root/.install-lock and retry."
trap 'rmdir "$root/.install-lock"' EXIT
[ ! -L "$bin/codeboard" ] || fail "$bin/codeboard is a symlink; remove or relocate it first."
if [ -e "$bin/codeboard" ]; then
  grep -q '^# Managed by the Codeboard installer$' "$bin/codeboard" || fail "$bin/codeboard is not managed by this installer."
fi
stage=$(mktemp -d "$root/.install.XXXXXX")
shim=''
cleanup() { rm -rf "$stage"; [ -z "$shim" ] || rm -f "$shim"; rmdir "$root/.install-lock"; }
trap cleanup EXIT
trap 'exit 1' HUP INT TERM
name="codeboard-$version-$platform"
asset="$name.tar.gz"
base="$repo/releases/download/v$version"
if [ -e "$target" ]; then
  [ -f "$target/.codeboard-install" ] && [ -x "$target/codeboard" ] || fail "$target already exists and is not an installed release."
  [ "$("$target/codeboard" --version)" = "$version" ] || fail 'Installed version does not match; remove the damaged release directory and retry.'
else
  printf 'Downloading Codeboard %s for %s...\n' "$version" "$platform"
  curl --proto '=https' --proto-redir '=https' -fsSL "$base/$asset" -o "$stage/$asset"
  curl --proto '=https' --proto-redir '=https' -fsSL "$base/SHA256SUMS" -o "$stage/SHA256SUMS"
  expected=$(awk -v name="$asset" '$2 == name {print $1}' "$stage/SHA256SUMS")
  printf '%s\n' "$expected" | grep -Eq '^[a-fA-F0-9]{64}$' || fail 'Missing or ambiguous checksum'
  if command -v sha256sum >/dev/null; then actual=$(sha256sum "$stage/$asset" | awk '{print $1}');
  elif command -v shasum >/dev/null; then actual=$(shasum -a 256 "$stage/$asset" | awk '{print $1}');
  else fail 'sha256sum or shasum is required'; fi
  [ "$actual" = "$expected" ] || fail 'Checksum mismatch. Nothing was installed.'
  tar -tzf "$stage/$asset" > "$stage/entries"
  awk -v root="$name" 'index($0,root "/") != 1 || $0 ~ /(^|\/)\.\.(\/|$)/ || $0 ~ /\\/ {bad=1} END {exit bad}' "$stage/entries" || fail 'Invalid archive paths'
  tar -xzf "$stage/$asset" -C "$stage"
  [ "$("$stage/$name/codeboard" --version)" = "$version" ] || fail 'The downloaded runtime could not start on this system.'
  printf '%s\n' "$version" > "$stage/$name/.codeboard-install"
  [ ! -e "$target" ] || fail 'Another installation completed concurrently; retry.'
  mv "$stage/$name" "$target"
fi
shim=$(mktemp "$bin/.codeboard.XXXXXX")
# Quote the absolute target for a shell wrapper, including home directories with apostrophes.
quoted=$(printf '%s' "$target/codeboard" | sed "s/'/'\\\\''/g")
printf '#!/bin/sh\n# Managed by the Codeboard installer\nexec '\''%s'\'' "$@"\n' "$quoted" > "$shim"
chmod 755 "$shim"
mv -f "$shim" "$bin/codeboard"
shim=''
if [ "$modify_path" -eq 1 ]; then
case "${SHELL:-}" in
  */zsh) profile="$HOME/.zshrc" ;;
  */bash) profile="$HOME/.bashrc" ;;
  *) profile="$HOME/.profile" ;;
esac
path_line='export PATH="$HOME/.local/bin:$PATH"'
if ! grep -Fqx "$path_line" "$profile" 2>/dev/null; then
  printf '\n# Codeboard\n%s\n' "$path_line" >> "$profile"
fi
fi
printf '\nCodeboard %s installed. Command: %s/codeboard\nOpen a new terminal, then run:\n  codeboard init\n  codeboard run scene.mjs\n' "$version" "$bin"
