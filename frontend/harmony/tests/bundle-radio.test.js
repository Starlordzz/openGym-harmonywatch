import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkRadioStartup } from '../../../scripts/harmony/check-lite-radio.mjs'

function fixture(callback) {
  return `(function(){return new ViewModel({data:{},onCreate:function(){
    var engine=requireNative('system.wearengine'),version,rx=false,tx='-',app=this;
    this.rt={radioStatus:function(){return 'sdk:'+(version||'?')+' rx:'+(rx?'ok':'off')+' tx:'+tx}};
    function connect(){if(!version){setTimeout(connect,50);return}
      engine.subscribeMsg({success:function(){rx=true;engine.sendMsg({success:function(){tx=207}})}})}
    engine.getWearEngineVersion({complete:${callback}});connect()
  },onDestroy:function(){}})})()`
}
test('compiled radio gate waits for the native version callback, registers RX and sends hello', () => {
  assert.equal(checkRadioStartup(fixture('function(v){version=v.split(".").pop()}')), 'sdk:402 rx:ok tx:207')
})
test('compiled radio gate rejects the empty callback found in the 206 regression', () => {
  assert.throws(() => checkRadioStartup(fixture('function(){}')), /sdk:\? rx:off tx:-/)
})
