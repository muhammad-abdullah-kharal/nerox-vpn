// PacketTunnelProvider.swift — Nerox VPN

import Foundation
import NetworkExtension
import WireGuardKit  // ✅ yeh import zaroor chahiye

class PacketTunnelProvider: NEPacketTunnelProvider {
  private lazy var adapter = WireGuardAdapter(with: self) { logLevel, message in
    NSLog("[WireGuard] \(message)")
  }

  override func startTunnel(options: [String: NSObject]?, completionHandler: @escaping (Error?) -> Void) {
    guard
      let tunnelProtocol = protocolConfiguration as? NETunnelProviderProtocol,
      let providerConfig = tunnelProtocol.providerConfiguration,
      let wgQuickConfig = providerConfig["wgQuickConfig"] as? String,
      !wgQuickConfig.isEmpty
    else {
      completionHandler(PacketTunnelError.missingWireGuardConfig)
      return
    }

    let tunnelName = (providerConfig["tunnelName"] as? String) ?? "nerox"

    do {
      let tunnelConfiguration = try TunnelConfiguration(fromWgQuickConfig: wgQuickConfig, called: tunnelName)
      adapter.start(tunnelConfiguration: tunnelConfiguration) { error in
        completionHandler(error)
      }
    } catch {
      completionHandler(error)
    }
  }

  override func stopTunnel(with reason: NEProviderStopReason, completionHandler: @escaping () -> Void) {
    adapter.stop { _ in
      completionHandler()
    }
  }

  override func handleAppMessage(_ messageData: Data, completionHandler: ((Data?) -> Void)?) {
    guard let messageString = String(data: messageData, encoding: .utf8) else {
      completionHandler?(nil)
      return
    }

    if messageString == "getTransferredByteCount" {
      adapter.getRuntimeConfiguration { configString in
        guard let configString = configString else {
          completionHandler?(nil)
          return
        }

        var totalRx: UInt64 = 0
        var totalTx: UInt64 = 0

        for line in configString.split(separator: "\n") {
          let trimmed = line.trimmingCharacters(in: .whitespaces)
          if trimmed.hasPrefix("rx_bytes=") {
            let value = trimmed.dropFirst("rx_bytes=".count)
            totalRx += UInt64(value) ?? 0
          } else if trimmed.hasPrefix("tx_bytes=") {
            let value = trimmed.dropFirst("tx_bytes=".count)
            totalTx += UInt64(value) ?? 0
          }
        }

        let responseDict: [String: Any] = [
          "totalReceived": totalRx,
          "totalSent": totalTx
        ]

        if let jsonData = try? JSONSerialization.data(withJSONObject: responseDict, options: []) {
          completionHandler?(jsonData)
        } else {
          completionHandler?(nil)
        }
      }
    } else {
      completionHandler?(nil)
    }
  }
}

enum PacketTunnelError: LocalizedError {
  case missingWireGuardConfig

  var errorDescription: String? {
    switch self {
    case .missingWireGuardConfig:
      return "Missing wgQuickConfig in providerConfiguration"
    }
  }
}