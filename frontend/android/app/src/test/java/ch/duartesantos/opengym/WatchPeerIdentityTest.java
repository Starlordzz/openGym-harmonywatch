package ch.duartesantos.opengym;

import org.junit.Test;
import static org.junit.Assert.*;

public class WatchPeerIdentityTest {
    private static final String PKG = "host.msknet.opengym.fit";
    private static final String OLD = "B7B7B7B7B7B7B7B7B7B7B7B7B7B7B7B7B7B7B7B7B7B7B7B7B7B7B7B7B7B7B7B7";
    private static final String PEER = PKG + "_BJc8JAa9rJKfqzas/d1BzWZrBv8+ECYLetB9fK0Zo1azvpUTL6izrUJNzYsYQI0ozMEMOOpYF9GmMB/ppUEBC4c=";

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
