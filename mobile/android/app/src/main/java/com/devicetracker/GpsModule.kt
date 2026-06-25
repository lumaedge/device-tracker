package com.devicetracker

import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.content.Context
import android.os.Bundle
import android.os.Looper
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class GpsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), LocationListener {

    private val locationManager = reactContext.getSystemService(Context.LOCATION_SERVICE) as LocationManager

    override fun getName() = "NativeGps"

    @ReactMethod
    fun start() {
        try {
            locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 15000L, 10f, this, Looper.getMainLooper())
            locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 15000L, 10f, this, Looper.getMainLooper())
        } catch (_: SecurityException) {}
    }

    @ReactMethod
    fun stop() {
        locationManager.removeUpdates(this)
    }

    override fun onLocationChanged(location: Location) {
        val args = Arguments.createMap()
        args.putDouble("latitude", location.latitude)
        args.putDouble("longitude", location.longitude)
        args.putDouble("accuracy", location.accuracy.toDouble())
        args.putDouble("speed", location.speed.toDouble())
        args.putDouble("altitude", location.altitude)
        args.putDouble("bearing", location.bearing.toDouble())
        val emitter = reactApplicationContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        emitter.emit("onGpsLocation", args)
    }

    override fun onProviderDisabled(provider: String) {}
    override fun onProviderEnabled(provider: String) {}
    override fun onStatusChanged(provider: String, status: Int, extras: Bundle) {}
}
