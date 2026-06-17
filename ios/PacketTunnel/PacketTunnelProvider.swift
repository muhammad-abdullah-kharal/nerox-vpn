// PacketTunnelProvider.swift — Nerox VPN
// Uses WireGuardKit 1.0.15-26 correct API

import Foundation
import NetworkExtension
import WireGuardKit

class PacketTunnelProvider: NEPacketTunnelProvider {

  private lazy var adapter = WireGuardAdapter(with: self) { _, message in
    NSLog("[WireGuard] \(message)")
  }

  override func startTunnel(
    options: [String: NSObject]?,
    completionHandler: @escaping (Error?) -> Void
  ) {
    guard
      let proto = protocolConfiguration as? NETunnelProviderProtocol,
      let cfg   = proto.providerConfiguration,
      let wgCfg = cfg["wgQuickConfig"] as? String,
      !wgCfg.isEmpty
    else {
      completionHandler(VPNError.missingConfig)
      return
    }

    let tunnelName = (cfg["tunnelName"] as? String) ?? "nerox"

    // TunnelConfiguration(fromWgQuickConfig:called:) is a convenience init
    // defined in TunnelConfiguration+WgQuickConfig.swift — it IS available
    // in WireGuardKit 1.0.15-26 via the WireGuardKit SPM product.
    // The init signature: convenience init(fromWgQuickConfig:String, called:String?) throws
    let tunnelConfig: TunnelConfiguration
    do {
      tunnelConfig = try TunnelConfiguration(fromWgQuickConfig: wgCfg, called: tunnelName)
    } catch {
      completionHandler(error)
      return
    }

    adapter.start(tunnelConfiguration: tunnelConfig) { adapterError in
      if let adapterError = adapterError {
        NSLog("[WireGuard] start error: \(adapterError)")
        completionHandler(adapterError)
      } else {
        completionHandler(nil)
      }
    }
  }

  override func stopTunnel(
    with reason: NEProviderStopReason,
    completionHandler: @escaping () -> Void
  ) {
    adapter.stop { _ in completionHandler() }
  }

  override func handleAppMessage(
    _ messageData: Data,
    completionHandler: ((Data?) -> Void)?
  ) {
    guard
      let msg = String(data: messageData, encoding: .utf8),
      msg == "getTransferredByteCount"
    else {
      completionHandler?(nil)
      return
    }

    adapter.getRuntimeConfiguration { cfgString in
      guard let cfgString = cfgString else {
        completionHandler?(nil)
        return
      }

      var rx: UInt64 = 0
      var tx: UInt64 = 0

      for line in cfgString.split(separator: "\n") {
        let t = line.trimmingCharacters(in: .whitespaces)
        if t.hasPrefix("rx_bytes=") {
          rx += UInt64(t.dropFirst("rx_bytes=".count)) ?? 0
        } else if t.hasPrefix("tx_bytes=") {
          tx += UInt64(t.dropFirst("tx_bytes=".count)) ?? 0
        }
      }

      let data = try? JSONSerialization.data(
        withJSONObject: ["totalReceived": rx, "totalSent": tx]
      )
      completionHandler?(data)
    }
  }
}

enum VPNError: LocalizedError {
  case missingConfig
  var errorDescription: String? {
    "Missing wgQuickConfig in providerConfiguration"
  }
}