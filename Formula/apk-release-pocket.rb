class ApkReleasePocket < Formula
  desc "Verify signed Android APKs and build self-hosted release pockets"
  homepage "https://apk-release-pocket.sociobot.in"
  version "0.1.0"
  license "MIT"

  # release.yml replaces this template with checksums from the tagged builds.
  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/B-Divyesh/sf-apk-release-pocket/releases/download/v0.1.0/apk-release-pocket-0.1.0-macos-aarch64.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    else
      url "https://github.com/B-Divyesh/sf-apk-release-pocket/releases/download/v0.1.0/apk-release-pocket-0.1.0-macos-x86_64.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    end
  end
  on_linux do
    url "https://github.com/B-Divyesh/sf-apk-release-pocket/releases/download/v0.1.0/apk-release-pocket-0.1.0-linux-x86_64.tar.gz"
    sha256 "0000000000000000000000000000000000000000000000000000000000000000"
  end
  def install
    bin.install "arp"
  end
  test do
    assert_match version.to_s, shell_output("#{bin}/arp --version")
  end
end
