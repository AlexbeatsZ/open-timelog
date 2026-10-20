package io.github.alexbeatsz.opentimelog;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.os.Build;
import android.view.View;
import android.graphics.Color;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.graphics.Insets;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TimelogFilesPlugin.class);
        super.onCreate(savedInstanceState);
        View root = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets keyboard = insets.getInsets(WindowInsetsCompat.Type.ime());
            view.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, keyboard.bottom));
            return WindowInsetsCompat.CONSUMED;
        });
        root.setBackgroundColor(Color.rgb(23,35,40));
        if (Build.VERSION.SDK_INT >= 33) bridge.getWebView().getSettings().setAlgorithmicDarkeningAllowed(false);
    }
}
