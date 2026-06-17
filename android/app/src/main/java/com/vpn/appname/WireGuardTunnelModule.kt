package com.vpn.appname

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.VpnService
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.wireguard.android.backend.GoBackend
import com.wireguard.android.backend.Tunnel
import com.wireguard.config.Config
import java.io.ByteArrayInputStream

class WireGuardTunnelModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val backend: GoBackend by lazy { GoBackend(reactContext.applicationContext) }
  private val statePrefs by lazy {
    reactContext.applicationContext.getSharedPreferences("nerox_vpn_state", Context.MODE_PRIVATE)
  }
  private val tunnel = NeroxTunnel { state -> persistState(state) }
  private var pendingConfig: String? = null
  private var pendingPromise: Promise? = null

  companion object {
    private const val VPN_PERMISSION_REQUEST = 9001
  }

  init {
    reactContext.addActivityEventListener(object : BaseActivityEventListener() {
      override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != VPN_PERMISSION_REQUEST) return

        val config = pendingConfig
        val promise = pendingPromise
        pendingConfig = null
        pendingPromise = null

        if (promise == null || config == null) return

        if (resultCode != Activity.RESULT_OK) {
          persistState(Tunnel.State.DOWN)
          promise.reject("VPN_PERMISSION_DENIED", "VPN permission was denied")
          return
        }

        startPreparedTunnel(config, promise)
      }
    })
  }

  override fun getName(): String = "WireGuardTunnel"

  @ReactMethod
  fun start(configText: String, promise: Promise) {
    val permissionIntent = VpnService.prepare(reactContext.applicationContext)
    if (permissionIntent != null) {
      val activity = currentActivity
      if (activity == null) {
        promise.reject("NO_ACTIVITY", "Cannot request VPN permission without an active Android activity")
        return
      }

      if (pendingPromise != null) {
        promise.reject("VPN_REQUEST_IN_PROGRESS", "A VPN permission request is already in progress")
        return
      }

      pendingConfig = configText
      pendingPromise = promise
      activity.startActivityForResult(permissionIntent, VPN_PERMISSION_REQUEST)
      return
    }

    startPreparedTunnel(configText, promise)
  }

  @ReactMethod
  fun stop(promise: Promise) {
    Thread {
      try {
        backend.setState(tunnel, Tunnel.State.DOWN, null)
        persistState(Tunnel.State.DOWN)
        promise.resolve(true)
      } catch (error: Exception) {
        promise.reject("WG_STOP_FAILED", error.message, error)
      }
    }.start()
  }

  @ReactMethod
  fun getStatus(promise: Promise) {
    try {
      val backendState = backend.getState(tunnel)
      if (backendState == Tunnel.State.UP) {
        persistState(backendState)
        promise.resolve(backendState.name)
        return
      }

      val savedState = statePrefs.getString("state", null)
      promise.resolve(savedState ?: backendState.name)
    } catch (error: Exception) {
      val savedState = statePrefs.getString("state", null)
      if (savedState != null) {
        promise.resolve(savedState)
      } else {
        promise.reject("WG_STATUS_FAILED", error.message, error)
      }
    }
  }

  @ReactMethod
  fun getStatistics(promise: Promise) {
    Thread {
      try {
        val stats = backend.getStatistics(tunnel)
        val result = Arguments.createMap()
        result.putDouble("totalReceived", stats.totalRx().toDouble())
        result.putDouble("totalSent", stats.totalTx().toDouble())
        promise.resolve(result)
      } catch (error: Exception) {
        promise.reject("WG_STATS_FAILED", error.message, error)
      }
    }.start()
  }

  private fun startPreparedTunnel(configText: String, promise: Promise) {
    Thread {
      try {
        val input = ByteArrayInputStream(configText.toByteArray(Charsets.UTF_8))
        val config = Config.parse(input)
        val state = backend.setState(tunnel, Tunnel.State.UP, config)
        persistState(state)
        promise.resolve(state.name)
      } catch (error: Exception) {
        persistState(Tunnel.State.DOWN)
        promise.reject("WG_START_FAILED", error.message, error)
      }
    }.start()
  }

  private fun persistState(state: Tunnel.State) {
    statePrefs.edit().putString("state", state.name).apply()
  }

  private class NeroxTunnel(private val onStateChanged: (Tunnel.State) -> Unit) : Tunnel {
    @Volatile
    private var currentState = Tunnel.State.DOWN

    override fun getName(): String = "nerox"

    override fun onStateChange(newState: Tunnel.State) {
      currentState = newState
      onStateChanged(newState)
    }
  }
}
