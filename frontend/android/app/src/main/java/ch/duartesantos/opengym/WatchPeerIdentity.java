package ch.duartesantos.opengym;

/** HarmonyOS 5+ Lite Wearable uses bundleName_Base64(uncompressed P-256 public key). */
final class WatchPeerIdentity {
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
}
