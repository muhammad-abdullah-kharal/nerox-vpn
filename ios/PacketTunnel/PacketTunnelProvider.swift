// PacketTunnelProvider.swift — Nerox VPN
// Contains manual parser for wg‑quick config strings

import Foundation
import NetworkExtension
import WireGuardKit

// MARK: - Parser for wg‑quick format (copied from WireGuardKit)

extension TunnelConfiguration {
    /// Creates a TunnelConfiguration from a wg‑quick config string.
    /// Throws an error if parsing fails.
    static func fromWgQuickConfig(_ config: String, called name: String?) throws -> TunnelConfiguration {
        var interface: InterfaceConfiguration?
        var peers: [PeerConfiguration] = []
        var currentPeer: PeerConfiguration?
        var currentSection: String = ""

        let lines = config.split(separator: "\n").map { String($0) }
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty || trimmed.hasPrefix("#") {
                continue
            }
            if trimmed.hasPrefix("[") && trimmed.hasSuffix("]") {
                let section = String(trimmed.dropFirst().dropLast())
                currentSection = section
                if section == "Peer" {
                    if let peer = currentPeer {
                        peers.append(peer)
                    }
                    currentPeer = PeerConfiguration()
                } else if section == "Interface" {
                    // start new interface
                    interface = InterfaceConfiguration()
                }
                continue
            }
            guard let (key, value) = parseKeyValue(line: trimmed) else { continue }
            switch currentSection {
            case "Interface":
                guard var iface = interface else { continue }
                switch key {
                case "PrivateKey":
                    iface.privateKey = try PrivateKey(base64Key: value)
                case "Address":
                    let addresses = value.split(separator: ",").compactMap { IPAddressRange(from: String($0)) }
                    iface.addresses = addresses
                case "DNS":
                    iface.dns = value.split(separator: ",").map { String($0) }
                case "MTU":
                    if let mtu = UInt16(value) { iface.mtu = mtu }
                case "ListenPort":
                    if let port = UInt16(value) { iface.listenPort = port }
                default: break
                }
                interface = iface
            case "Peer":
                guard var peer = currentPeer else { continue }
                switch key {
                case "PublicKey":
                    peer.publicKey = try PublicKey(base64Key: value)
                case "PresharedKey":
                    peer.preSharedKey = try PreSharedKey(base64Key: value)
                case "AllowedIPs":
                    let ips = value.split(separator: ",").compactMap { IPAddressRange(from: String($0)) }
                    peer.allowedIPs = ips
                case "Endpoint":
                    if let endpoint = Endpoint(from: value) {
                        peer.endpoint = endpoint
                    }
                case "PersistentKeepalive":
                    if let interval = UInt16(value) {
                        peer.persistentKeepAlive = interval
                    }
                default: break
                }
                currentPeer = peer
            default: break
            }
        }
        if let peer = currentPeer {
            peers.append(peer)
        }
        guard let interface = interface else {
            throw NSError(domain: "WireGuard", code: -1, userInfo: [NSLocalizedDescriptionKey: "Missing [Interface] section"])
        }
        return TunnelConfiguration(name: name, interface: interface, peers: peers)
    }

    private static func parseKeyValue(line: String) -> (key: String, value: String)? {
        let parts = line.split(separator: "=", maxSplits: 1).map { String($0) }
        guard parts.count == 2 else { return nil }
        return (parts[0].trimmingCharacters(in: .whitespaces), parts[1].trimmingCharacters(in: .whitespaces))
    }
}

// MARK: - Helper types for parsing (copied from WireGuardKit)

struct IPAddressRange {
    let address: IPAddress
    let networkPrefixLength: UInt8
    init?(from string: String) {
        let parts = string.split(separator: "/")
        guard parts.count <= 2 else { return nil }
        guard let addr = IPAddress(from: String(parts[0])) else { return nil }
        self.address = addr
        if parts.count == 2, let prefix = UInt8(String(parts[1])) {
            self.networkPrefixLength = prefix
        } else {
            self.networkPrefixLength = addr.isIPv4 ? 32 : 128
        }
    }
}

struct Endpoint {
    let host: String
    let port: UInt16
    init?(from string: String) {
        let parts = string.split(separator: ":").map { String($0) }
        guard parts.count == 2 else { return nil }
        self.host = parts[0]
        guard let port = UInt16(parts[1]) else { return nil }
        self.port = port
    }
}

// MARK: - PacketTunnelProvider

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

        let tunnelConfig: TunnelConfiguration
        do {
            tunnelConfig = try TunnelConfiguration.fromWgQuickConfig(wgCfg, called: tunnelName)
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