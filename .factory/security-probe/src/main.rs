use apksig::{Algorithms, Apk};
use rsa::{RsaPrivateKey, pkcs8::DecodePrivateKey};
use std::{env, fs, fs::File, path::PathBuf};

fn main() {
    let args: Vec<PathBuf> = env::args_os().skip(1).map(PathBuf::from).collect();
    let source = Apk::new(args[0].clone()).unwrap();
    fs::write(&args[1], source.get_raw_apk().unwrap()).unwrap();
    let private = RsaPrivateKey::from_pkcs8_der(&fs::read(&args[2]).unwrap()).unwrap();
    let certificate = fs::read(&args[3]).unwrap();
    let mut apk = Apk::new_raw(args[1].clone()).unwrap();
    apk.sign_v2(&Algorithms::RSASSA_PKCS1_v1_5_256, &certificate, private).unwrap();
    apk.write_with_signature(&mut File::create(&args[4]).unwrap()).unwrap();
}
