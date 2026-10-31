package ch.duartesantos.opengym;

import static org.junit.Assert.*;
import org.junit.Test;

public class WatchRestPlanTest {
    @Test public void ignoresOldBootsRevisionsAndExpiredNewPlans() {
        assertEquals(WatchRestPlan.IGNORE, WatchRestPlan.decide("new", 20, "", "old", 30, 90000, true, 1000));
        assertEquals(WatchRestPlan.IGNORE, WatchRestPlan.decide("new", 20, "", "new", 19, 90000, true, 1000));
        assertEquals(WatchRestPlan.IGNORE, WatchRestPlan.decide("new", 20, "", "new", 30, 90000, true, 91000));
        assertEquals(WatchRestPlan.IGNORE, WatchRestPlan.decide("new", 20, "", "new", 30, 10_000_000, true, 1000));
    }
    @Test public void repeatedPacketsDoNotRescheduleOrReplayAnAlert() {
        assertEquals(WatchRestPlan.KEEP, WatchRestPlan.decide("b", 20, "b:90000", "b", 30, 90000, true, 1000));
        assertEquals(WatchRestPlan.KEEP, WatchRestPlan.decide("b", 20, "b:90000", "b", 30, 90000, true, 91000));
    }
    @Test public void extensionReplacesAndEarlySkipOrDisabledHapticsCancels() {
        assertEquals(WatchRestPlan.SCHEDULE, WatchRestPlan.decide("b", 20, "b:90000", "b", 30, 105000, true, 1000));
        assertEquals(WatchRestPlan.CANCEL, WatchRestPlan.decide("b", 20, "b:90000", "b", 30, 0, true, 1000));
        assertEquals(WatchRestPlan.CANCEL, WatchRestPlan.decide("b", 20, "b:90000", "b", 30, 90000, false, 1000));
    }
    @Test public void neverRingsEarlyOrForAnOldRestAfterDoze() {
        assertFalse(WatchRestPlan.due(90000, 89999));
        assertTrue(WatchRestPlan.due(90000, 90000));
        assertTrue(WatchRestPlan.due(90000, 120000));
        assertFalse(WatchRestPlan.due(90000, 120001));
    }
}
