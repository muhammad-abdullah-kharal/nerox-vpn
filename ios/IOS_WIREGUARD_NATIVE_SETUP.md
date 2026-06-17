# iOS WireGuard Native Setup

This project now has the React Native iOS bridge for starting and stopping a VPN through Apple's NetworkExtension API:

- `ios/Nerox/WireGuardTunnel.h`
- `ios/Nerox/WireGuardTunnel.m`
- `NetworkExtension.framework` linked in `ios/Nerox.xcodeproj`
- `services/VpnService.js` calls `NativeModules.WireGuardTunnel.start(config)` with the WireGuard config from the backend

The remaining iOS VPN part must be completed in Xcode on macOS because Apple requires a Packet Tunnel extension target, signing, and Network Extension entitlements.

## Required Xcode setup

1. Open the iOS project on a Mac:

   ```sh
   cd ios
   pod install
   open Nerox.xcworkspace
   ```

   If `Nerox.xcworkspace` is not generated, open `Nerox.xcodeproj`.

2. Set the real bundle identifier for the main app.

   Current project still uses the React Native default bundle id. Change it to your real app id, for example:

   ```text
   com.nerox.vpn
   ```

3. Add Apple capability to the main `Nerox` target:

   ```text
   Signing & Capabilities -> + Capability -> Network Extensions
   ```

   Enable packet tunnel provider support. This needs a paid Apple Developer account and a provisioning profile that allows Network Extensions.

4. Add a new target:

   ```text
   File -> New -> Target -> Network Extension -> Packet Tunnel Provider
   Product Name: PacketTunnel
   Bundle Identifier: com.nerox.vpn.PacketTunnel
   ```

   Important: the extension bundle id must be the main app bundle id plus `.PacketTunnel`. The app bridge uses:

   ```objc
   protocol.providerBundleIdentifier = [NSString stringWithFormat:@"%@.PacketTunnel", bundleId];
   ```

5. Add Network Extensions capability to the `PacketTunnel` target too.

6. Add WireGuard engine to the `PacketTunnel` target.

   Use WireGuardKit / wireguard-go inside the extension target. The extension must read the config from:

   ```swift
   let providerConfig = protocolConfiguration.providerConfiguration
   let wgQuickConfig = providerConfig?["wgQuickConfig"] as? String
   ```

   Then start the WireGuard tunnel with that config.

   A starter template is available at:

   ```text
   ios/PacketTunnel/PacketTunnelProvider.swift.template
   ```

7. Test on a real iPhone.

   iOS VPN does not behave like a real device tunnel on the simulator. First connect should show Apple's system dialog asking permission to add VPN configuration. After allowing, the tunnel can start and the public IP should change.

## Expected flow

1. App calls backend `POST /api/sessions`.
2. Backend returns real WireGuard config.
3. `services/VpnService.js` passes that config to `WireGuardTunnel.start(config)`.
4. iOS `WireGuardTunnel.m` saves a `NETunnelProviderManager` profile.
5. The `PacketTunnel` extension receives `wgQuickConfig` and starts WireGuard.

## Common failures

- `Native WireGuard module is not linked`: clean build the iOS app after adding `WireGuardTunnel.m` to the target.
- `WG_START_FAILED`: PacketTunnel target, bundle id, entitlement, or provisioning profile is missing.
- No Apple permission dialog: the VPN profile may already be saved, or the app is not signed with Network Extension entitlement.
- Connect succeeds but IP does not change: PacketTunnel extension is not running the WireGuard engine yet.