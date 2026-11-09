#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
LAB=/opt/ckbuilder-week07
WIN='/mnt/e/ckbuilder/Week 07'
mkdir -p "$LAB/tools" "$LAB/downloads" "$LAB/source" "$LAB/logs"
exec > >(tee -a "$LAB/logs/bootstrap.log") 2>&1
echo "Week07 isolated Linux toolchain setup"
apt-get update -qq
apt-get install -y --no-install-recommends build-essential ca-certificates curl git unzip jq python3 python-is-python3 python3-venv tmux tmuxp expect pkg-config libssl-dev clang-18 llvm-18 gcc-riscv64-unknown-elf binutils-riscv64-unknown-elf libc6-dev-riscv64-cross libc6-riscv64-cross linux-libc-dev-riscv64-cross
export CARGO_HOME="$LAB/cargo"
export RUSTUP_HOME="$LAB/rustup"
export GOPATH="$LAB/go-cache"
export PATH="$LAB/tools/go/bin:$CARGO_HOME/bin:$LAB/tools/bin:$PATH"
export CARGO_BUILD_JOBS=4
export CARGO_PROFILE_DEV_DEBUG=0
export CARGO_PROFILE_TEST_DEBUG=0
mkdir -p "$LAB/tools/bin"
cat > "$LAB/env.sh" <<'ENV'
export LAB=/opt/ckbuilder-week07
export CARGO_HOME="$LAB/cargo"
export RUSTUP_HOME="$LAB/rustup"
export GOPATH="$LAB/go-cache"
export PATH="$LAB/tools/go/bin:$CARGO_HOME/bin:$LAB/tools/bin:$PATH"
export CARGO_BUILD_JOBS=4
export CARGO_PROFILE_DEV_DEBUG=0
export CARGO_PROFILE_TEST_DEBUG=0
ENV
if ! command -v rustup >/dev/null 2>&1; then
  curl -fsSL --retry 3 https://sh.rustup.rs -o "$LAB/downloads/rustup-init.sh"
  sh "$LAB/downloads/rustup-init.sh" -y --profile minimal --default-toolchain 1.85.0 --no-modify-path
fi
rustup target add riscv64imac-unknown-none-elf --toolchain 1.85.0
if [ ! -x "$LAB/tools/go/bin/go" ]; then
  curl -fL --retry 3 --silent --show-error https://go.dev/dl/go1.23.4.linux-amd64.tar.gz -o "$LAB/downloads/go.tar.gz"
  echo '6924efde5de86fe277676e929dc9917d466efa02fb934197bc2eba35d5680971  '"$LAB/downloads/go.tar.gz" | sha256sum --check
  tar -xzf "$LAB/downloads/go.tar.gz" -C "$LAB/tools"
fi
for spec in 'ckb v0.201.0' 'ckb-cli v1.13.0'; do
  read -r tool version <<< "$spec"
  if [ ! -x "$LAB/tools/bin/$tool" ]; then
    archive="${tool}_${version}_x86_64-unknown-linux-gnu.tar.gz"
    curl -fL --retry 3 --silent --show-error "https://github.com/nervosnetwork/$tool/releases/download/$version/$archive" -o "$LAB/downloads/$archive"
    mkdir -p "$LAB/tools/$tool"
    tar -xzf "$LAB/downloads/$archive" -C "$LAB/tools/$tool"
    binary=$(find "$LAB/tools/$tool" -type f -name "$tool" | head -n 1)
    ln -s "$binary" "$LAB/tools/bin/$tool"
  fi
done
SRC="$LAB/source/perun-network-perun-examples-6e975e7/payment-channel-ckb"
if [ ! -f "$SRC/main.go" ]; then
  cached='/mnt/e/ckbuilder/Week 06/runtime/downloads/perun-examples.zip'
  if [ -f "$cached" ]; then
    cp "$cached" "$LAB/downloads/perun-examples.zip"
  else
    curl -fL --retry 3 --silent --show-error https://api.github.com/repos/perun-network/perun-examples/zipball/6e975e7d2f61a80d1d13b71330a2415086b82242 -o "$LAB/downloads/perun-examples.zip"
  fi
  unzip -q "$LAB/downloads/perun-examples.zip" '*/payment-channel-ckb/*' -d "$LAB/source"
fi
# Only the isolated copy is executable or modified. Earlier weeks stay untouched.
find "$SRC" -type f \( -name '*.sh' -o -name '*.expect' -o -name 'find_clang' \) -exec chmod u+x {} +
# A compatibility header required by the bundled RISC-V C dependency.
if [ ! -e /usr/riscv64-linux-gnu/include/gnu/stubs-lp64.h ] && [ -f /usr/riscv64-linux-gnu/include/gnu/stubs-lp64d.h ]; then
  ln -s stubs-lp64d.h /usr/riscv64-linux-gnu/include/gnu/stubs-lp64.h
fi
go version
rustc --version
cargo --version
ckb --version
ckb-cli --version
clang-18 --version | head -n 1
echo "$SRC" > "$LAB/source-path.txt"
echo 'Week07 bootstrap complete'

