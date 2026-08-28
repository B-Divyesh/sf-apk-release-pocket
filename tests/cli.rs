use assert_cmd::Command;
use predicates::prelude::*;

#[test]
fn help_describes_the_workflow() {
    Command::cargo_bin("arp")
        .unwrap()
        .arg("--help")
        .assert()
        .success()
        .stdout(predicate::str::contains("static download page"));
}

#[test]
fn invalid_input_has_documented_exit_code() {
    Command::cargo_bin("arp")
        .unwrap()
        .args(["inspect", "missing.apk", "--json"])
        .assert()
        .code(3)
        .stderr(predicate::str::contains("cannot read"));
}
