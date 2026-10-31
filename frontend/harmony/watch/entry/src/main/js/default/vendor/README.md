# Huawei Wear Engine Lite SDK

Unmodified Huawei WearEngine-LiteWearable 5.0.2.306, Apache License 2.0. Original copyright and
license header remain in wearengine.js; the license text is included alongside it.

Primary download page:
https://developer.huawei.com/consumer/cn/doc/connectivity-Library/litewearable-sdk-0000001051627695

Official ZIP SHA-256:
64130a347647f00d734662523b5a26daca015e87ece7d5d916f19753759a1b56

wearengine.js SHA-256 (also supplied inside the official ZIP):
8c7f1100c840abdb237991b0d436ef9ab49a215269c5fecdb3dd59fe63a71471

The official constructor obtains its service version asynchronously. The local sdk-ready adapter
waits for this result before registering a receiver, avoiding the SDK's legacy FeatureAbility
branch while the version is still undefined. The SDK file itself is not patched.
