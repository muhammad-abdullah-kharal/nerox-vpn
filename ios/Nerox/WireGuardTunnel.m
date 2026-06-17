#import "WireGuardTunnel.h"
#import <NetworkExtension/NetworkExtension.h>

static NSError *WireGuardBridgeError(NSString *message, NSError *underlyingError)
{
  NSMutableDictionary *userInfo = [NSMutableDictionary dictionaryWithObject:message ?: @"WireGuard tunnel failed"
                                                                     forKey:NSLocalizedDescriptionKey];
  if (underlyingError != nil) {
    userInfo[NSUnderlyingErrorKey] = underlyingError;
  }

  return [NSError errorWithDomain:@"WireGuardTunnel"
                             code:underlyingError != nil ? underlyingError.code : 1
                         userInfo:userInfo];
}

@implementation WireGuardTunnel

RCT_EXPORT_MODULE();

RCT_REMAP_METHOD(start,
                 startWithConfig:(NSString *)config
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  if (config.length == 0) {
    reject(@"WG_CONFIG_EMPTY", @"WireGuard config is empty", nil);
    return;
  }

  [NETunnelProviderManager loadAllFromPreferencesWithCompletionHandler:^(NSArray<NETunnelProviderManager *> *managers, NSError *error) {
    if (error != nil) {
      NSString *message = error.localizedDescription ?: @"Failed to load iOS VPN configurations";
      reject(@"WG_LOAD_FAILED", message, WireGuardBridgeError(message, error));
      return;
    }

    NETunnelProviderManager *manager = managers.firstObject ?: [[NETunnelProviderManager alloc] init];
    NETunnelProviderProtocol *protocol = [[NETunnelProviderProtocol alloc] init];
    NSString *bundleId = [[NSBundle mainBundle] bundleIdentifier];
    protocol.providerBundleIdentifier = [NSString stringWithFormat:@"%@.PacketTunnel", bundleId];
    protocol.serverAddress = @"Nerox WireGuard";
    protocol.providerConfiguration = @{
      @"wgQuickConfig": config,
      @"tunnelName": @"nerox"
    };

    manager.protocolConfiguration = protocol;
    manager.localizedDescription = @"Nerox VPN";
    manager.enabled = YES;

    [manager saveToPreferencesWithCompletionHandler:^(NSError *saveError) {
      if (saveError != nil) {
        NSString *message = [NSString stringWithFormat:@"%@. Check that the main app is signed with the Network Extension entitlement.",
                             saveError.localizedDescription ?: @"Failed to save iOS VPN configuration"];
        reject(@"WG_SAVE_FAILED", message, WireGuardBridgeError(message, saveError));
        return;
      }

      [manager loadFromPreferencesWithCompletionHandler:^(NSError *reloadError) {
        if (reloadError != nil) {
          NSString *message = reloadError.localizedDescription ?: @"Failed to reload iOS VPN configuration";
          reject(@"WG_RELOAD_FAILED", message, WireGuardBridgeError(message, reloadError));
          return;
        }

        NSError *startError = nil;
        BOOL started = [manager.connection startVPNTunnelAndReturnError:&startError];
        if (!started || startError != nil) {
          NSString *message = [NSString stringWithFormat:@"%@. Check that the PacketTunnel extension target is embedded and signed, and that its bundle id matches %@.PacketTunnel.",
                               startError.localizedDescription ?: @"Failed to start iOS VPN tunnel",
                               bundleId];
          reject(@"WG_START_FAILED", message, WireGuardBridgeError(message, startError));
          return;
        }

        resolve(@"UP");
      }];
    }];
  }];
}

RCT_REMAP_METHOD(stop,
                 stopWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  [NETunnelProviderManager loadAllFromPreferencesWithCompletionHandler:^(NSArray<NETunnelProviderManager *> *managers, NSError *error) {
    if (error != nil) {
      NSString *message = error.localizedDescription ?: @"Failed to load iOS VPN configurations";
      reject(@"WG_LOAD_FAILED", message, WireGuardBridgeError(message, error));
      return;
    }

    for (NETunnelProviderManager *manager in managers) {
      [manager.connection stopVPNTunnel];
    }

    resolve(@YES);
  }];
}

RCT_REMAP_METHOD(getStatus,
                 getStatusWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  [NETunnelProviderManager loadAllFromPreferencesWithCompletionHandler:^(NSArray<NETunnelProviderManager *> *managers, NSError *error) {
    if (error != nil) {
      NSString *message = error.localizedDescription ?: @"Failed to load iOS VPN configurations";
      reject(@"WG_LOAD_FAILED", message, WireGuardBridgeError(message, error));
      return;
    }

    NETunnelProviderManager *manager = managers.firstObject;
    if (manager == nil) {
      resolve(@"DISCONNECTED");
      return;
    }

    switch (manager.connection.status) {
      case NEVPNStatusConnected:
        resolve(@"UP");
        break;
      case NEVPNStatusConnecting:
        resolve(@"CONNECTING");
        break;
      case NEVPNStatusDisconnecting:
        resolve(@"DISCONNECTING");
        break;
      default:
        resolve(@"DOWN");
        break;
    }
  }];
}

RCT_REMAP_METHOD(getStatistics,
                 getStatisticsWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  [NETunnelProviderManager loadAllFromPreferencesWithCompletionHandler:^(NSArray<NETunnelProviderManager *> *managers, NSError *error) {
    if (error != nil || managers.count == 0) {
      resolve(@{@"totalReceived": @(0), @"totalSent": @(0)});
      return;
    }

    NETunnelProviderManager *manager = managers.firstObject;
    NETunnelProviderSession *session = (NETunnelProviderSession *)manager.connection;

    if (session == nil || session.status != NEVPNStatusConnected) {
      resolve(@{@"totalReceived": @(0), @"totalSent": @(0)});
      return;
    }

    // Send a message to the PacketTunnel extension requesting traffic stats
    NSError *sendError = nil;
    NSData *messageData = [@"getTransferredByteCount" dataUsingEncoding:NSUTF8StringEncoding];
    [session sendProviderMessage:messageData
                    returnError:&sendError
                responseHandler:^(NSData * _Nullable responseData) {
      if (responseData == nil) {
        // Extension didn't respond with stats - return zeros
        resolve(@{@"totalReceived": @(0), @"totalSent": @(0)});
        return;
      }

      NSError *jsonError = nil;
      NSDictionary *stats = [NSJSONSerialization JSONObjectWithData:responseData options:0 error:&jsonError];
      if (jsonError != nil || stats == nil) {
        resolve(@{@"totalReceived": @(0), @"totalSent": @(0)});
        return;
      }

      NSNumber *rx = stats[@"totalReceived"] ?: @(0);
      NSNumber *tx = stats[@"totalSent"] ?: @(0);
      resolve(@{@"totalReceived": rx, @"totalSent": tx});
    }];

    if (sendError != nil) {
      // If sendProviderMessage fails, return zeros gracefully
      resolve(@{@"totalReceived": @(0), @"totalSent": @(0)});
    }
  }];
}

@end
