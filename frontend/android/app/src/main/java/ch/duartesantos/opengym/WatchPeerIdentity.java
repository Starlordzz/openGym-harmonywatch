package ch.duartesantos.opengym;

import java.util.List;

/** HarmonyOS 5+ Lite Wearable uses bundleName_Base64(uncompressed P-256 public key). */
final class WatchPeerIdentity {
    static final int P2P_SUPPORTED = 0;
    static final int P2P_NOT_SUPPORTED = 1;

    static boolean valid(String pkg, String fingerprint) {
        if (!pkg.matches("[a-zA-Z][a-zA-Z0-9_]*(\\.[a-zA-Z0-9_]+)+") || fingerprint.length() > 127
                || !fingerprint.startsWith(pkg + "_")) return false;
        // 65-byte uncompressed point: leading 04, 88 Base64 characters including one '='.
        return fingerprint.substring(pkg.length() + 1).matches("B[A-P][A-Za-z0-9+/]{84}[AEIMQUYcgkosw048]=");
    }

    static String migrate(String pkg, String fingerprint, String knownPkg, String oldSha256, String peer) {
        return pkg.equals(knownPkg) && fingerprint.matches("[a-fA-F0-9]{64}")
                && fingerprint.equalsIgnoreCase(oldSha256) && valid(pkg, peer) ? peer : fingerprint;
    }

    /** Picks a connected watch index: P2P-capable (0) first, unknown (!=1) fallback, remembering lastUuid. */
    static int selectConnectedIndex(List<String> uuids, List<Integer> p2pCapabilities, String preferredUuid) {
        if (uuids == null || p2pCapabilities == null || uuids.size() != p2pCapabilities.size() || uuids.isEmpty()) return -1;
        int fallback = -1;
        int supportedCount = 0;
        int supportedFirst = -1;
        for (int i = 0; i < uuids.size(); i++) {
            int cap = p2pCapabilities.get(i);
            if (cap == P2P_NOT_SUPPORTED) continue;
            String uuid = uuids.get(i);
            if (cap == P2P_SUPPORTED) {
                if (preferredUuid != null && !preferredUuid.isEmpty() && preferredUuid.equals(uuid)) return i;
                if (supportedFirst < 0) supportedFirst = i;
                supportedCount++;
            } else {
                if (preferredUuid != null && !preferredUuid.isEmpty() && preferredUuid.equals(uuid) && fallback < 0) fallback = i;
                if (fallback < 0) fallback = i;
            }
        }
        if (supportedCount > 0) return supportedFirst;
        return fallback;
    }
}
