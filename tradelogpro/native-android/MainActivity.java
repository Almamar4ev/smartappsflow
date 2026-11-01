package com.tradelog.pro;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

// Copied over the Capacitor-generated MainActivity by CI
// (.github/workflows/build-tradelogpro.yml, "Add native system bar handling").
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SystemBarsPlugin.class); // must run before super.onCreate
        super.onCreate(savedInstanceState);
        SystemBarsPlugin.install(this, getBridge().getWebView());
    }
}
