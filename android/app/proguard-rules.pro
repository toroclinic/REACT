# React Native core — keep reflection targets used by the bridge
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# OkHttp (used by Metro/fetch polyfill)
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# AsyncStorage
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# react-native-health-connect (Health Connect SDK)
-keep class androidx.health.connect.** { *; }
-keep class dev.matinzd.healthconnect.** { *; }

# react-native-vector-icons — font loading uses reflection
-keep class com.oblador.vectoricons.** { *; }

# react-native-screens
-keep class com.swmansion.rnscreens.** { *; }

# react-native-safe-area-context
-keep class com.th3rdwave.safeareacontext.** { *; }

# react-native-netinfo
-keep class com.reactnativecommunity.netinfo.** { *; }

# Kotlin metadata (required for Kotlin reflection used by some RN modules)
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions

# Keep JavaScript interface annotations
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Suppress warnings for optional native modules
-dontwarn com.facebook.react.modules.network.**
-dontwarn com.facebook.soloader.**
