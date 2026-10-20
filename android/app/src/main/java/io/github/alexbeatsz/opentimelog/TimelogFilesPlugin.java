package io.github.alexbeatsz.opentimelog;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.provider.OpenableColumns;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "TimelogFiles")
public class TimelogFilesPlugin extends Plugin {
    private static final int LIMIT = 10 * 1024 * 1024;
    private boolean pickerOpen = false;

    @PluginMethod
    public void save(PluginCall call) {
        if (pickerOpen) { call.reject("请先完成当前文件选择。"); return; }
        String data = call.getString("data"), name = call.getString("name");
        if (data == null || name == null || name.length() > 200 || name.contains("/") || name.contains("\\")) { call.reject("导出内容无效。"); return; }
        if (data.getBytes(StandardCharsets.UTF_8).length > LIMIT) { call.reject("导出文件超过 10 MB。"); return; }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(call.getString("mime", "application/json"));
        intent.putExtra(Intent.EXTRA_TITLE, name);
        pickerOpen = true;
        startActivityForResult(call, intent, "saved");
    }

    @ActivityCallback
    private void saved(PluginCall call, ActivityResult result) {
        pickerOpen = false;
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) { call.reject("已取消保存，原数据保留。", "CANCELLED"); return; }
        getBridge().execute(() -> {
            try (OutputStream stream = getContext().getContentResolver().openOutputStream(result.getData().getData(), "wt")) {
                if (stream == null) throw new IOException("无法打开目标文件");
                stream.write(call.getString("data", "").getBytes(StandardCharsets.UTF_8));
                stream.flush(); call.resolve();
            } catch (Exception error) { call.reject("文件未保存：" + error.getMessage()); }
        });
    }

    @PluginMethod
    public void open(PluginCall call) {
        if (pickerOpen) { call.reject("请先完成当前文件选择。"); return; }
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE); intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain", "application/octet-stream"});
        pickerOpen = true; startActivityForResult(call, intent, "opened");
    }

    @ActivityCallback
    private void opened(PluginCall call, ActivityResult result) {
        pickerOpen = false;
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) { call.reject("已取消选择。", "CANCELLED"); return; }
        getBridge().execute(() -> {
            try {
                android.net.Uri uri = result.getData().getData();
                String name = "backup.json";
                try (Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null)) {
                    if (cursor != null && cursor.moveToFirst()) {
                        int at = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                        if (at >= 0) name = cursor.getString(at);
                    }
                }
                try (InputStream stream = getContext().getContentResolver().openInputStream(uri); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
                    if (stream == null) throw new IOException("无法打开文件");
                    byte[] buffer = new byte[8192]; int count;
                    while ((count = stream.read(buffer)) != -1) { if (bytes.size() + count > LIMIT) throw new IOException("备份超过 10 MB"); bytes.write(buffer, 0, count); }
                    JSObject response = new JSObject(); response.put("name", name); response.put("data", bytes.toString(StandardCharsets.UTF_8.name())); call.resolve(response);
                }
            } catch (Exception error) { call.reject("无法读取备份：" + error.getMessage()); }
        });
    }
}
