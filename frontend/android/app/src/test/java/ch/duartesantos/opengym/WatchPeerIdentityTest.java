package ch.duartesantos.opengym;

import org.junit.Test;
import static org.junit.Assert.*;

public class WatchPeerIdentityTest {
    private static final String PKG = "example.opengym.watch";
    private static final String OLD = "B7".repeat(32);
    // Uncompressed NIST P-256 generator point, used only as a synthetic public key.
    private static final String PEER = PKG + "_BGsX0fLhLEJH+Lzm5WOkQPJ3A32BLeszoPShOUXYmMKWT+NC4v4af5uO5+tKfA+eFivOM1drMV7Oy7ZAaDe/UfU=";

    @Test public void acceptsCaseSensitiveLitePublicKeyIdentity() {
        assertTrue(WatchPeerIdentity.valid(PKG, PEER));
        assertFalse(WatchPeerIdentity.valid(PKG, OLD));
        assertFalse(WatchPeerIdentity.valid("another.watch", PEER));
        assertFalse(WatchPeerIdentity.valid(PKG, PEER.replace("=", "")));
    }

    @Test public void migratesOnlyTheKnownPreviousCertificateForThisBundle() {
        assertEquals(PEER, WatchPeerIdentity.migrate(PKG, OLD.toLowerCase(), PKG, OLD, PEER));
        assertEquals(PEER, WatchPeerIdentity.migrate(PKG, PEER, PKG, OLD, PEER));
        String custom = "A".repeat(64);
        assertEquals(custom, WatchPeerIdentity.migrate(PKG, custom, PKG, OLD, PEER));
        assertEquals(OLD, WatchPeerIdentity.migrate("another.watch", OLD, PKG, OLD, PEER));
        assertEquals(OLD, WatchPeerIdentity.migrate(PKG, OLD, PKG, OLD, ""));
    }
}
