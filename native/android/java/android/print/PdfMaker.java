package android.print;

import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import java.io.File;

/**
 * Writes a WebView's print output straight to a PDF file, with no print dialog. It lives in
 * android.print because the layout and write callbacks can only be made from this package.
 * Page size, margins and page breaks come from the page's own CSS (@page, break-before).
 */
public class PdfMaker {
    public interface Done {
        void ok(File file);

        void fail(String why);
    }

    public static void write(final PrintDocumentAdapter adapter, final PrintAttributes attrs, final File file, final Done done) {
        adapter.onStart();
        adapter.onLayout(null, attrs, new CancellationSignal(), new PrintDocumentAdapter.LayoutResultCallback() {
            @Override
            public void onLayoutFinished(PrintDocumentInfo info, boolean changed) {
                try {
                    final ParcelFileDescriptor pfd = ParcelFileDescriptor.open(file,
                            ParcelFileDescriptor.MODE_CREATE | ParcelFileDescriptor.MODE_TRUNCATE | ParcelFileDescriptor.MODE_READ_WRITE);
                    adapter.onWrite(new PageRange[] {PageRange.ALL_PAGES}, pfd, new CancellationSignal(), new PrintDocumentAdapter.WriteResultCallback() {
                        @Override
                        public void onWriteFinished(PageRange[] pages) {
                            try {
                                pfd.close();
                            } catch (Exception ignored) {
                            }
                            adapter.onFinish();
                            done.ok(file);
                        }

                        @Override
                        public void onWriteFailed(CharSequence error) {
                            try {
                                pfd.close();
                            } catch (Exception ignored) {
                            }
                            adapter.onFinish();
                            done.fail(String.valueOf(error));
                        }
                    });
                } catch (Exception e) {
                    done.fail(String.valueOf(e.getMessage()));
                }
            }

            @Override
            public void onLayoutFailed(CharSequence error) {
                done.fail(String.valueOf(error));
            }
        }, null);
    }
}
