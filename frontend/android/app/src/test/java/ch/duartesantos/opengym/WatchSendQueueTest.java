package ch.duartesantos.opengym;
import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;
public class WatchSendQueueTest {
    @Test public void controlsFollowActiveHeadInFragmentOrder() {
        ArrayDeque<String> q = new ArrayDeque<>(Arrays.asList("active", "frame1", "frame2"));
        WatchSendQueue.prioritize(q, Arrays.asList("rest1", "rest2"), true);
        assertEquals("active", q.poll());
        assertEquals(Arrays.asList("rest1", "rest2", "frame1", "frame2"), new ArrayList<>(q));
    }
    @Test public void idleQueueStartsWithControlAndKeepsAllFrames() {
        ArrayDeque<String> q = new ArrayDeque<>(Arrays.asList("frame1"));
        WatchSendQueue.prioritize(q, Arrays.asList("rest1", "rest2"), false);
        assertEquals(Arrays.asList("rest1", "rest2", "frame1"), new ArrayList<>(q));
    }
}
