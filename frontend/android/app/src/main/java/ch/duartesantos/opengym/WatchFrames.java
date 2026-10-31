package ch.duartesantos.opengym;

import android.content.Context;
import android.graphics.*;
import android.graphics.drawable.*;
import android.media.MediaMetadataRetriever;
import android.os.Build;
import android.os.Handler;
import android.os.SystemClock;
import java.io.*;
import java.nio.ByteBuffer;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Consumer;

/** Small PNG frames for the Lite image component. Source assets never leave the phone unchanged. */
final class WatchFrames {
    private final Context context;
    private final Handler main;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private boolean closed;
    WatchFrames(Context context, Handler main) { this.context = context; this.main = main; }
    void close() { closed = true; worker.shutdownNow(); }
    void render(String path, File directory, Consumer<List<File>> done, Consumer<Exception> failed) {
        if (!path.matches("[A-Za-z0-9_./-]+\\.(webp|gif|mp4)") || path.contains("..") || path.startsWith("/")) {
            failed.accept(new IOException("Invalid clip asset path")); return;
        }
        worker.execute(() -> {
            try {
                if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("Cannot create frame cache");
                ArrayList<File> files = new ArrayList<>();
                if (path.endsWith(".mp4")) {
                    try (android.content.res.AssetFileDescriptor asset = context.getAssets().openFd("public/" + path);
                         MediaMetadataRetriever video = new MediaMetadataRetriever()) {
                        video.setDataSource(asset.getFileDescriptor(), asset.getStartOffset(), asset.getLength());
                        long duration = Long.parseLong(video.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION));
                        for (int i = 0; i < 16 && !closed; i++) {
                            Bitmap frame = video.getFrameAtTime(duration * 1000 * i / 16, MediaMetadataRetriever.OPTION_CLOSEST);
                            if (frame == null) throw new IOException("Cannot decode video frame");
                            files.add(writeFrame(directory, i, frame)); frame.recycle();
                        }
                    }
                    main.post(() -> { if (!closed) done.accept(files); });
                    return;
                }
                byte[] bytes;
                try (InputStream in = context.getAssets().open("public/" + path); ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
                    byte[] block = new byte[8192]; int n;
                    while ((n = in.read(block)) != -1) {
                        buffer.write(block, 0, n);
                        if (buffer.size() > 32 * 1024 * 1024) throw new IOException("Clip asset too large");
                    }
                    bytes = buffer.toByteArray();
                }
                Movie movie = Movie.decodeByteArray(bytes, 0, bytes.length);
                if (movie != null && movie.duration() > 0) {
                    for (int i = 0; i < 16 && !closed; i++) {
                        Bitmap bitmap = Bitmap.createBitmap(144, 144, Bitmap.Config.ARGB_8888);
                        Canvas canvas = new Canvas(bitmap); canvas.drawColor(Color.WHITE);
                        float scale = Math.min(144f / movie.width(), 144f / movie.height());
                        canvas.translate((144 - movie.width() * scale) / 2, (144 - movie.height() * scale) / 2); canvas.scale(scale, scale);
                        movie.setTime(movie.duration() * i / 16); movie.draw(canvas, 0, 0);
                        files.add(writeFrame(directory, i, bitmap)); bitmap.recycle();
                    }
                    main.post(() -> { if (!closed) done.accept(files); });
                } else if (Build.VERSION.SDK_INT >= 28) {
                    Drawable drawable = ImageDecoder.decodeDrawable(ImageDecoder.createSource(ByteBuffer.wrap(bytes)));
                    main.post(() -> capture(drawable, directory, files, 0, done, failed));
                } else throw new IOException("Animated WebP requires Android 9 or later");
            } catch (Exception e) { main.post(() -> failed.accept(e)); }
        });
    }
    private void capture(Drawable drawable, File dir, ArrayList<File> files, int index,
                         Consumer<List<File>> done, Consumer<Exception> failed) {
        if (closed) return;
        try {
            if (index == 0 && drawable instanceof Animatable) {
                drawable.setCallback(new Drawable.Callback() {
                    @Override public void invalidateDrawable(Drawable who) {}
                    @Override public void scheduleDrawable(Drawable who, Runnable what, long when) { main.postAtTime(what, when); }
                    @Override public void unscheduleDrawable(Drawable who, Runnable what) { main.removeCallbacks(what); }
                });
                ((Animatable) drawable).start();
            }
            Bitmap bitmap = Bitmap.createBitmap(144, 144, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap); canvas.drawColor(Color.WHITE);
            int width = Math.max(1, drawable.getIntrinsicWidth()), height = Math.max(1, drawable.getIntrinsicHeight());
            float scale = Math.min(144f / width, 144f / height);
            int w = Math.round(width * scale), h = Math.round(height * scale);
            drawable.setBounds((144 - w) / 2, (144 - h) / 2, (144 + w) / 2, (144 + h) / 2);
            drawable.draw(canvas); files.add(writeFrame(dir, index, bitmap)); bitmap.recycle();
            if (index < 15 && drawable instanceof Animatable) {
                main.postDelayed(() -> capture(drawable, dir, files, index + 1, done, failed), 125);
            } else {
                if (drawable instanceof Animatable) ((Animatable) drawable).stop();
                drawable.setCallback(null); done.accept(files);
            }
        } catch (Exception e) { if (drawable instanceof Animatable) ((Animatable) drawable).stop(); drawable.setCallback(null); failed.accept(e); }
    }
    private File writeFrame(File dir, int index, Bitmap source) throws IOException {
        Bitmap bitmap = source.getWidth() == 144 && source.getHeight() == 144 ? source : Bitmap.createScaledBitmap(source, 144, 144, true);
        File file = new File(dir, dir.getName() + "-" + index + ".png");
        try (FileOutputStream out = new FileOutputStream(file)) { if (!bitmap.compress(Bitmap.CompressFormat.PNG, 0, out)) throw new IOException("Cannot encode frame"); }
        if (bitmap != source) bitmap.recycle();
        return file;
    }
}
