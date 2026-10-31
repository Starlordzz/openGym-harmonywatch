package ch.duartesantos.opengym;

/** Pure ordering/expiry rules for the phone alarm relayed from the paired Lite watch. */
final class WatchRestPlan {
    static final int IGNORE = 0, KEEP = 1, CANCEL = 2, SCHEDULE = 3;
    static final long MAX_REST_MS = 2 * 60 * 60 * 1000L;
    static final long MAX_LATENESS_MS = 30_000;

    private WatchRestPlan() {}

    static int decide(String currentBoot, long revision, String key, String boot, long incomingRevision,
                      long at, boolean enabled, long now) {
        if (boot.isEmpty() || !boot.equals(currentBoot) || incomingRevision < 0 || incomingRevision < revision) return IGNORE;
        if (!enabled || at == 0) return CANCEL;
        if (at < 0 || at - now > MAX_REST_MS) return IGNORE;
        if (key.equals(boot + ":" + at)) return KEEP;
        if (at <= now) return IGNORE;
        return SCHEDULE;
    }

    static boolean due(long at, long now) { return at > 0 && now >= at && now - at <= MAX_LATENESS_MS; }
}
