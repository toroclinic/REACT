package com.wellnessplus

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate

class MainActivity : ReactActivity() {

    // app.json's `name` ("WellnessPlus") must match this exactly — this is
    // the string RN's JS bundle registry uses to find the root component
    // registered in index.js (AppRegistry.registerComponent(appName, ...)).
    override fun getMainComponentName(): String = "WellnessPlus"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    // Must be registered in onCreate before any permission request fires.
    // Without this the HealthConnectPermissionDelegate lateinit properties
    // (requestPermission, requestRoutePermission) remain uninitialized and
    // crash with UninitializedPropertyAccessException on the IO dispatcher.
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        HealthConnectPermissionDelegate.setPermissionDelegate(this)
    }

    // react-native-screens throws if Android tries to restore a previously
    // saved ScreenFragment (e.g. after process death). Clearing the fragment
    // key prevents the restore without affecting any other saved state.
    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.remove("android:support:fragments")
    }
}
