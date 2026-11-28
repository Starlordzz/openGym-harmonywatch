package ch.duartesantos.opengym;

import android.content.Context;
import android.graphics.*;
import android.graphics.drawable.*;
import android.media.MediaMetadataRetriever;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import java.io.*;
import java.nio.ByteBuffer;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

/** Small PNG frames for the Lite image component. Source assets never leave the phone unchanged. */
final class WatchFrames {
    private static final int SIZE = 128;
    private final Context context;
    private final Handler main;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final HandlerThread captureThread;
    private final Handler captureHandler;
    private volatile boolean closed;
    WatchFrames(Context context, Handler main) {
        this.context = context;
        this.main = main;
        this.captureThread = new HandlerThread("watch-frames");
        this.captureThread.start();
        this.captureHandler = new Handler(captureThread.getLooper());
    }
    void close() {
        closed = true;
        worker.shutdownNow();
        captureHandler.removeCallbacksAndMessages(null);
        captureThread.quitSafely();
    }
    void render(String path, File directory, BooleanSupplier cancelled, Consumer<List<File>> done, Consumer<Exception> failed) {
        if (!path.matches("[A-Za-z0-9_./-]+\\.(webp|gif|mp4)") || path.contains("..") || path.startsWith("/")) {
            failed.accept(new IOException("Invalid clip asset path")); return;
        }
        worker.execute(() -> {
            try {
                if (closed || cancelled.getAsBoolean()) { main.post(() -> failed.accept(new CancellationException("Animation transfer cancelled"))); return; }
                if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("Cannot create frame cache");
                ArrayList<File> files = new ArrayList<>();
                if (path.endsWith(".mp4")) {
                    try (android.content.res.AssetFileDescriptor asset = context.getAssets().openFd("public/" + path);
                         MediaMetadataRetriever video = new MediaMetadataRetriever()) {
                        video.setDataSource(asset.getFileDescriptor(), asset.getStartOffset(), asset.getLength());
                        long duration = Long.parseLong(video.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION));
                        for (int i = 0; i < 16 && !closed && !cancelled.getAsBoolean(); i++) {
                            Bitmap frame = video.getFrameAtTime(duration * 1000 * i / 16, MediaMetadataRetriever.OPTION_CLOSEST);
                            if (frame == null) throw new IOException("Cannot decode video frame");
                            files.add(writeFrame(directory, i, frame)); frame.recycle();
                        }
                    }
                    if (closed || cancelled.getAsBoolean()) { main.post(() -> failed.accept(new CancellationException("Animation transfer cancelled"))); return; }
                    main.post(() -> { if (!closed && !cancelled.getAsBoolean()) done.accept(files); });
                    return;
                }
                byte[] bytes;
                try (InputStream in = context.getAssets().open("public/" + path); ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
                    byte[] block = new byte[8192]; int n;
                    while ((n = in.read(block)) != -1) {
                        if (closed || cancelled.getAsBoolean()) { main.post(() -> failed.accept(new CancellationException("Animation transfer cancelled"))); return; }
                        buffer.write(block, 0, n);
                        if (buffer.size() > 32 * 1024 * 1024) throw new IOException("Clip asset too large");
                    }
                    bytes = buffer.toByteArray();
                }
                Movie movie = Movie.decodeByteArray(bytes, 0, bytes.length);
                if (movie != null && movie.duration() > 0) {
                    for (int i = 0; i < 16 && !closed && !cancelled.getAsBoolean(); i++) {
                        Bitmap bitmap = Bitmap.createBitmap(SIZE, SIZE, Bitmap.Config.ARGB_8888);
                        Canvas canvas = new Canvas(bitmap); canvas.drawColor(Color.WHITE);
                        float scale = Math.min((float) SIZE / movie.width(), (float) SIZE / movie.height());
                        canvas.translate((SIZE - movie.width() * scale) / 2, (SIZE - movie.height() * scale) / 2); canvas.scale(scale, scale);
                        movie.setTime(movie.duration() * i / 16); movie.draw(canvas, 0, 0);
                        files.add(writeFrame(directory, i, bitmap)); bitmap.recycle();
                    }
                    if (closed || cancelled.getAsBoolean()) { main.post(() -> failed.accept(new CancellationException("Animation transfer cancelled"))); return; }
                    main.post(() -> { if (!closed && !cancelled.getAsBoolean()) done.accept(files); });
                } else if (Build.VERSION.SDK_INT >= 28) {
                    Drawable drawable = ImageDecoder.decodeDrawable(ImageDecoder.createSource(ByteBuffer.wrap(bytes)));
                    captureHandler.post(() -> capture(drawable, directory, files, 0, cancelled, done, failed));
                } else throw new IOException("Animated WebP requires Android 9 or later");
            } catch (Exception e) { main.post(() -> failed.accept(e)); }
        });
    }
    private void capture(Drawable drawable, File dir, ArrayList<File> files, int index, BooleanSupplier cancelled,
                         Consumer<List<File>> done, Consumer<Exception> failed) {
        if (closed || cancelled.getAsBoolean()) {
            if (drawable instanceof Animatable) ((Animatable) drawable).stop();
            drawable.setCallback(null);
            main.post(() -> failed.accept(new CancellationException("Animation transfer cancelled")));
            return;
        }
        try {
            if (index == 0 && drawable instanceof Animatable) {
                drawable.setCallback(new Drawable.Callback() {
                    @Override public void invalidateDrawable(Drawable who) {}
                    @Override public void scheduleDrawable(Drawable who, Runnable what, long when) { captureHandler.postAtTime(what, when); }
                    @Override public void unscheduleDrawable(Drawable who, Runnable what) { captureHandler.removeCallbacks(what); }
                });
                ((Animatable) drawable).start();
            }
            Bitmap bitmap = Bitmap.createBitmap(SIZE, SIZE, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap); canvas.drawColor(Color.WHITE);
            int width = Math.max(1, drawable.getIntrinsicWidth()), height = Math.max(1, drawable.getIntrinsicHeight());
            float scale = Math.min((float) SIZE / width, (float) SIZE / height);
            int w = Math.round(width * scale), h = Math.round(height * scale);
            drawable.setBounds((SIZE - w) / 2, (SIZE - h) / 2, (SIZE + w) / 2, (SIZE + h) / 2);
            drawable.draw(canvas); files.add(writeFrame(dir, index, bitmap)); bitmap.recycle();
            if (index < 15 && drawable instanceof Animatable) {
                captureHandler.postDelayed(() -> capture(drawable, dir, files, index + 1, cancelled, done, failed), 125);
            } else {
                if (drawable instanceof Animatable) ((Animatable) drawable).stop();
                drawable.setCallback(null);
                main.post(() -> { if (!closed && !cancelled.getAsBoolean()) done.accept(files); });
            }
        } catch (Exception e) {
            if (drawable instanceof Animatable) ((Animatable) drawable).stop();
            drawable.setCallback(null);
            main.post(() -> failed.accept(e));
        }
    }
    private File writeFrame(File dir, int index, Bitmap source) throws IOException {
        Bitmap bitmap = source.getWidth() == SIZE && source.getHeight() == SIZE ? source : Bitmap.createScaledBitmap(source, SIZE, SIZE, true);
        File file = new File(dir, dir.getName() + "-" + index + ".png");
        try (FileOutputStream out = new FileOutputStream(file)) { if (!bitmap.compress(Bitmap.CompressFormat.PNG, 0, out)) throw new IOException("Cannot encode frame"); }
        if (bitmap != source) bitmap.recycle();
        return file;
    }
}
