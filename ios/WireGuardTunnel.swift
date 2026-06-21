import Foundation
import NetworkExtension

@objc(WireGuardTunnel)
class WireGuardTunnel: NSObject {

  private var manager: NETunnelProviderManager?

  @objc
  static func requiresMainQueueSetup() -> Bool { return false }

  // JS se: WireGuardTunnel.start(config)
  @objc(start:resolver:rejecter:)
  func start(_ config: String,
             resolver resolve: @escaping RCTPromiseResolveBlock,
             rejecter reject: @escaping RCTPromiseRejectBlock) {

    NETunnelProviderManager.loadAllFromPreferences { managers, error in
      if let error = error {
        reject("WG_LOAD_FAILED", error.localizedDescription, error)
        return
      }

      let mgr = managers?.first ?? NETunnelProviderManager()

      let proto = NETunnelProviderProtocol()
      proto.providerBundleIdentifier = "org.reactjs.native.example.Nerox.PacketTunnel"
      proto.serverAddress = "Nerox VPN"
      proto.providerConfiguration = [
        "wgQuickConfig": config,
        "tunnelName": "nerox"
      ]

      mgr.protocolConfiguration = proto
      mgr.localizedDescription = "Nerox VPN"
      mgr.isEnabled = true

      // YEH LINE pehli baar VPN permission popup laati hai 👇
      mgr.saveToPreferences { error in
        if let error = error {
          reject("WG_SAVE_FAILED", error.localizedDescription, error)
          return
        }
        // Save ke baad load karna zaroori hai
        mgr.loadFromPreferences { error in
          if let error = error {
            reject("WG_RELOAD_FAILED", error.localizedDescription, error)
            return
          }
          do {
            try mgr.connection.startVPNTunnel()
            self.manager = mgr
            resolve("STARTED")
          } catch {
            reject("WG_START_FAILED", error.localizedDescription, error)
          }
        }
      }
    }
  }

  @objc(stop:rejecter:)
  func stop(_ resolve: @escaping RCTPromiseResolveBlock,
            rejecter reject: @escaping RCTPromiseRejectBlock) {
    NETunnelProviderManager.loadAllFromPreferences { managers, error in
      managers?.first?.connection.stopVPNTunnel()
      resolve(true)
    }
  }

  @objc(getStatus:rejecter:)
  func getStatus(_ resolve: @escaping RCTPromiseResolveBlock,
                 rejecter reject: @escaping RCTPromiseRejectBlock) {
    NETunnelProviderManager.loadAllFromPreferences { managers, error in
      guard let mgr = managers?.first else { resolve("DISCONNECTED"); return }
      switch mgr.connection.status {
      case .connected:    resolve("CONNECTED")
      case .connecting:   resolve("CONNECTING")
      case .reasserting:  resolve("CONNECTING")
      default:            resolve("DISCONNECTED")
      }
    }
  }

  @objc(getStatistics:rejecter:)
  func getStatistics(_ resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) {
    NETunnelProviderManager.loadAllFromPreferences { managers, error in
      guard let session = managers?.first?.connection as? NETunnelProviderSession else {
        resolve(["totalReceived": 0, "totalSent": 0]); return
      }
      do {
        try session.sendProviderMessage("getTransferredByteCount".data(using: .utf8)!) { data in
          if let data = data,
             let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            resolve(json)
          } else {
            resolve(["totalReceived": 0, "totalSent": 0])
          }
        }
      } catch {
        resolve(["totalReceived": 0, "totalSent": 0])
      }
    }
  }
}