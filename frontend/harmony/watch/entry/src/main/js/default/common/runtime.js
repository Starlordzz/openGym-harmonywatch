import storage from '@system.storage'
import vibrator from '@system.vibrator'
import file from '@system.file'
import sensor from '@system.sensor'
import brightness from '@system.brightness'
import { P2pClient, Message, Builder } from '../vendor/wearengine.js'
import peer from './peer.js'
import { waitForSdk } from './sdk-ready.js'
import { createRuntime } from './controller.js'

export function runtime(changed, failure) {
  var client = new P2pClient()
  return createRuntime({ ready: function(done, fail) { waitForSdk(client, setTimeout, done, fail) }, storage: storage, vibrator: vibrator, sensor: sensor, brightness: brightness,
    remove: function(uri) { file.delete({ uri: uri, fail: function() {} }) },
    client: client, peer: peer, Message: Message, Builder: Builder,
    setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: setInterval, clearInterval: clearInterval }, changed, failure)
}
