package com.wellnessplus

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

    // app.json's `name` ("WellnessPlus") must match this exactly — this is
    // the string RN's JS bundle registry uses to find the root component
    // registered in index.js (AppRegistry.registerComponent(appName, ...)).
    override fun getMainComponentName(): String = "WellnessPlus"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
