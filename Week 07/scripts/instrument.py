#!/usr/bin/env python3
"""Instrument only the isolated copy; keep all validation and payment calls upstream."""
import pathlib, shutil, sys
scripts=pathlib.Path(__file__).resolve().parent
root=pathlib.Path('/opt/ckbuilder-week07')
src=pathlib.Path((root/'source-path.txt').read_text().strip())
assert src.resolve()==root/'source/perun-network-perun-examples-6e975e7/payment-channel-ckb'
main=src/'main.go'
backup=src/'main.go.upstream'
if not backup.exists(): shutil.copy2(main,backup)
text=backup.read_text()
replacements=[
 ('log.Println("Sending payments....")','recordPair("05-channel-open", chAlice, chBob, 100, 100)\n\tlog.Println("Sending payments....")'),
 ('log.Println("Alice sent Bob a payment")','log.Println("Alice sent Bob a payment")\n\trecordPair("06-alice-pays-bob", chAlice, chBob, 90, 110)'),
 ('log.Println("Bob sent Alice a payment")','log.Println("Bob sent Alice a payment")\n\trecordPair("07-bob-pays-alice", chAlice, chBob, 95, 105)'),
 ('chAlice.Settle()','chAlice.Settle()\n\trecordPair("08-channel-settled", chAlice, chBob, 95, 105)'),
]
for old,new in replacements:
 assert text.count(old)==1,old
 text=text.replace(old,new)
main.write_text(text)
shutil.copy2(scripts/'observations.go',src/'observations.go')
print('Observation hooks added to isolated official main.go; payment amounts unchanged.')

