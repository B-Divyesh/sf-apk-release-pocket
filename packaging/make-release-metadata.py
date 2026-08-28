#!/usr/bin/env python3
"""Build latest.json and package-manager templates from finished release assets."""
import hashlib
import json
import pathlib
import sys

version, tag, directory = sys.argv[1], sys.argv[2], pathlib.Path(sys.argv[3])
base = f"https://github.com/B-Divyesh/sf-apk-release-pocket/releases/download/{tag}"
names = {
    "linux-x86_64": f"apk-release-pocket-{version}-linux-x86_64.tar.gz",
    "macos-x86_64": f"apk-release-pocket-{version}-macos-x86_64.tar.gz",
    "macos-aarch64": f"apk-release-pocket-{version}-macos-aarch64.tar.gz",
    "windows-x86_64": f"apk-release-pocket-{version}-windows-x86_64.zip",
}

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

assets = {}
for platform, name in names.items():
    path = directory / name
    if not path.exists():
        raise SystemExit(f"missing expected release asset: {name}")
    assets[platform] = {"name": name, "url": f"{base}/{name}", "sha256": digest(path)}
    (directory / f"{name}.sha256").write_text(f"{assets[platform]['sha256']}  {name}\n")

(directory / "latest.json").write_text(json.dumps({"version": f"v{version}", "assets": assets}, indent=2) + "\n")

formula = f'''class ApkReleasePocket < Formula
  desc "Verify signed Android APKs and build self-hosted release pockets"
  homepage "https://apk-release-pocket.sociobot.in"
  version "{version}"
  license "MIT"
  on_macos do
    if Hardware::CPU.arm?
      url "{assets['macos-aarch64']['url']}"
      sha256 "{assets['macos-aarch64']['sha256']}"
    else
      url "{assets['macos-x86_64']['url']}"
      sha256 "{assets['macos-x86_64']['sha256']}"
    end
  end
  on_linux do
    url "{assets['linux-x86_64']['url']}"
    sha256 "{assets['linux-x86_64']['sha256']}"
  end
  def install
    bin.install "arp"
  end
  test do
    assert_match version.to_s, shell_output("#{{bin}}/arp --version")
  end
end
'''
(directory / "apk-release-pocket.rb").write_text(formula)

scoop = {
    "version": version,
    "description": "Verify signed Android APKs and build self-hosted release pockets",
    "homepage": "https://apk-release-pocket.sociobot.in",
    "license": "MIT",
    "url": assets["windows-x86_64"]["url"],
    "hash": assets["windows-x86_64"]["sha256"],
    "bin": "arp.exe",
    "checkver": {"github": "https://github.com/B-Divyesh/sf-apk-release-pocket"},
    "autoupdate": {"url": "https://github.com/B-Divyesh/sf-apk-release-pocket/releases/download/v$version/apk-release-pocket-$version-windows-x86_64.zip"},
}
(directory / "apk-release-pocket.json").write_text(json.dumps(scoop, indent=2) + "\n")

winget = f'''PackageIdentifier: B-Divyesh.APKReleasePocket
PackageVersion: {version}
InstallerType: zip
NestedInstallerType: portable
NestedInstallerFiles:
  - RelativeFilePath: arp.exe
    PortableCommandAlias: arp
Installers:
  - Architecture: x64
    InstallerUrl: {assets['windows-x86_64']['url']}
    InstallerSha256: {assets['windows-x86_64']['sha256'].upper()}
ManifestType: installer
ManifestVersion: 1.6.0
'''
(directory / "B-Divyesh.APKReleasePocket.installer.yaml").write_text(winget)
