package ch.duartesantos.opengym;

import java.util.ArrayDeque;
import java.util.List;

/** Insert control packets after the in-flight head; its callback still removes that head. */
final class WatchSendQueue {
    static <T> void prioritize(ArrayDeque<T> queue, List<T> packets, boolean sending) {
        T active = sending ? queue.pollFirst() : null;
        for (int i = packets.size() - 1; i >= 0; i--) queue.addFirst(packets.get(i));
        if (active != null) queue.addFirst(active);
    }
}
