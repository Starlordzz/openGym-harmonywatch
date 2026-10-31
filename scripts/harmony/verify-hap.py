#!/usr/bin/env python3
"""Container and Lite permission metadata checks; SDK cryptographic verification is separate."""
import argparse
import subprocess
import tempfile
import zipfile
from pathlib import Path
p = argparse.ArgumentParser()
p.add_argument('hap', type=Path)
a = p.parse_args()
with zipfile.ZipFile(a.hap) as archive:
    bad = archive.testzip()
    if bad:
        raise SystemExit('Corrupt member: ' + bad)
    bins = [x for x in archive.namelist() if x.endswith('.bin') and '/' not in x or x.endswith('/app.bin') or x.endswith('/watchapp.bin')]
    if not bins:
        raise SystemExit('No Lite executable found; check target and debug build mode')
    checker = Path(__file__).resolve().with_name('check-lite-config.mjs')
    with tempfile.TemporaryDirectory(prefix='opengym-hap-config-') as directory:
        for index, member in enumerate(bins):
            binary = Path(directory) / ('app-' + str(index) + '.bin')
            binary.write_bytes(archive.read(member))
            result = subprocess.run(['node', str(checker), '--bin', str(binary)], capture_output=True, text=True)
            if result.returncode:
                raise SystemExit(result.stdout + result.stderr)
            print(result.stdout.strip())
    print('Container OK; executable:', ', '.join(bins))
    print('Run the SDK hap-sign-tool verify-app before installing. ZIP validity does not prove signing validity.')
