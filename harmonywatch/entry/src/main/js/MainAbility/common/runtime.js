import storage from '@system.storage'
import vibrator from '@system.vibrator'
import file from '@system.file'
import brightness from '@system.brightness'
import { P2pClient, Message, Builder } from '../vendor/wearengine.js'
import peer from './peer.js'
import { waitForSdk } from './sdk-ready.js'
import { createRuntime } from './controller.js'
import { stateStorage } from './state-storage.js'
import { fileCleaner } from './file-cleaner.js'

export function runtime(changed, failure) {
  var client = new P2pClient()
  return createRuntime({ ready: function(done, fail) { return waitForSdk(client, setTimeout, done, fail, clearTimeout) }, storage: stateStorage(storage, file), vibrator: vibrator, brightness: brightness,
    remove: fileCleaner(file, setTimeout),
    client: client, peer: peer, Message: Message, Builder: Builder,
    setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: setInterval, clearInterval: clearInterval }, changed, failure)
}
