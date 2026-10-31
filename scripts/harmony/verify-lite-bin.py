#!/usr/bin/env python3
"""Verify this project's SHA256/ECDSA Lite BIN with OpenSSL and pinned public inputs.

The installed SDK signs BIN but dispatches verify-app -inForm bin to VerifyElf.
Layout/digest follow SDK SignBin, SignHead, BlockHead, SignContentInfo and
HashUtils.getFileDigest (SHA256 of concatenated 4096-byte chunk SHA256 digests).
This checks bytes and the pinned signer, not device acceptance or service approval.
Verify the supplied certificate chain and Profile separately before using them.
"""
import argparse
import hashlib
import struct
import subprocess
import tempfile
from pathlib import Path


def require(condition, message):
    if not condition:
        raise ValueError(message)


def verify(binary, profile, certificate):
    data = Path(binary).read_bytes()
    require(len(data) >= 48, 'Truncated BIN')
    require(data[-32:-16] == b'hw signed app   ', 'Invalid BIN signature magic')
    require(data[-16:-12] == b'1000', 'Unsupported BIN signature version')
    size, count = struct.unpack('>II', data[-12:-4])
    require(48 < size <= len(data) and count == 2, 'Invalid signature size/count')
    require(data[-4:] == bytes(4), 'Invalid signature trailer reserved bytes')
    start = len(data) - size
    kind, reserved, length, profile_offset = struct.unpack_from('>BBHI', data, start)
    sig_kind, sig_reserved, sig_length, signature_offset = struct.unpack_from('>BBHI', data, start + 8)
    require((kind, reserved, sig_kind, sig_reserved, sig_length) == (2, 0, 0, 0, 0),
            'Unsupported signature block layout')
    require(profile_offset == start + 16 and signature_offset == profile_offset + length
            and signature_offset < len(data) - 32, 'Invalid signature block offsets')
    require(data[profile_offset:signature_offset] == Path(profile).read_bytes(),
            'Embedded Profile differs from verified Profile')
    with tempfile.TemporaryDirectory(prefix='opengym-bin-verify-') as directory:
        tmp = Path(directory)
        cms = tmp / 'signature.der'
        content = tmp / 'content.bin'
        cms.write_bytes(data[signature_offset:-32])
        result = subprocess.run([
            'openssl', 'cms', '-verify', '-binary', '-inform', 'DER', '-in', str(cms),
            '-noverify', '-nointern', '-certfile', str(certificate), '-out', str(content)
        ], capture_output=True)
        # -noverify skips chain building only; -nointern pins the actual signer to
        # the supplied leaf. CMS signature and signed-attribute checks remain on.
        require(result.returncode == 0, 'CMS signature does not verify with pinned certificate')
        signed_content = content.read_bytes()
    require(signed_content[:16] == bytes.fromhex('31303030003000010088000600000020')
            and len(signed_content) == 48, 'Unsupported signed SHA256 content header')
    chunks = (hashlib.sha256(data[i:min(i + 4096, signature_offset)]).digest()
              for i in range(0, signature_offset, 4096))
    digest = hashlib.sha256(b''.join(chunks)).digest()
    require(signed_content[16:] == digest, 'BIN payload digest mismatch')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('binary', type=Path)
    parser.add_argument('--profile', required=True, type=Path)
    parser.add_argument('--certificate', required=True, type=Path, help='Previously verified signer leaf PEM')
    args = parser.parse_args()
    try:
        verify(args.binary, args.profile, args.certificate)
    except (ValueError, OSError, struct.error) as error:
        parser.exit(1, 'BIN verification failed: ' + str(error) + '\n')
    print('BIN verified: pinned CMS signer, chunked SHA256 payload digest and exact Profile match')


if __name__ == '__main__':
    main()
