// OpenHarmony Lite/GT SetReqPermission requires reason + usedScene.when, even though
// the SDK's configSchema_lite.json only requires name. Missing metadata returns error 46.
// Reference: bundlemanager_bundle_framework_lite, OpenHarmony-v7.0-Release,
// services/bundlemgr_lite/src/{gt_bundle_parser,bundle_parser}.cpp.
const requiredPermissions = [
  ['ohos.permission.VIBRATE', '用于训练休息结束时的振动提醒'],
  ['ohos.permission.READ_HEALTH_DATA', '用于训练时读取和显示心率']
]

export function configurePermissions(module, abilityName) {
  const permissions = module.reqPermissions ?? []
  if (!Array.isArray(permissions)) throw Error('module.reqPermissions must be an array')
  for (const [name, reason] of requiredPermissions) {
    let entry = permissions.find(p => p && p.name === name)
    if (!entry) { entry = { name }; permissions.push(entry) }
    if (entry.reason === undefined) entry.reason = reason
    if (entry.usedScene === undefined) entry.usedScene = {}
    if (!entry.usedScene || typeof entry.usedScene !== 'object' || Array.isArray(entry.usedScene)) throw Error(name + ': usedScene must be an object')
    if (entry.usedScene.ability === undefined) entry.usedScene.ability = [abilityName]
    if (entry.usedScene.when === undefined) entry.usedScene.when = 'inuse'
  }
  module.reqPermissions = permissions
  checkPermissions({ module })
}

export function checkPermissions(config) {
  const module = config.module
  if (!module || !module.deviceType?.includes('liteWearable')) throw Error('Expected a Lite Wearable config')
  for (const ability of module.abilities || []) {
    if (Object.hasOwn(ability, 'permissions')) throw Error('Lite system API permissions belong in module.reqPermissions, not module.abilities.permissions')
  }
  if (module.reqPermissions === undefined) return
  if (!Array.isArray(module.reqPermissions)) throw Error('module.reqPermissions must be an array')
  for (const [index, permission] of module.reqPermissions.entries()) {
    const prefix = 'module.reqPermissions[' + index + ']'
    if (!permission || typeof permission.name !== 'string' || !permission.name.trim()) throw Error(prefix + '.name must be a non-empty string (Lite error 46)')
    if (typeof permission.reason !== 'string' || !permission.reason.trim()) throw Error(prefix + '.reason is required by the Lite installer (error 46)')
    if (!['inuse', 'always'].includes(permission.usedScene?.when)) throw Error(prefix + '.usedScene.when must be inuse or always (Lite error 46)')
  }
}

export function readBinConfig(buffer) {
  // Installed haptobin_tool format: 0xBE, uint32 BE bundle-name length, bundle name,
  // then config.json's uint32 filename length/name, 8 header bytes and uint32 data length.
  if (buffer.length < 21 || buffer[0] !== 0xbe) throw Error('Unsupported Lite BIN header')
  const bundleLength = buffer.readUInt32BE(1)
  const record = 5 + bundleLength
  if (record + 4 > buffer.length) throw Error('Truncated Lite BIN bundle header')
  const nameLength = buffer.readUInt32BE(record)
  const nameEnd = record + 4 + nameLength
  if (!nameLength || nameEnd + 12 > buffer.length) throw Error('Truncated Lite BIN file header')
  const name = buffer.subarray(record + 4, nameEnd).toString('utf8').replace(/\0$/, '')
  if (name !== 'config.json') throw Error('Expected config.json as the first Lite BIN record')
  const length = buffer.readUInt32BE(nameEnd + 8)
  const start = nameEnd + 12
  if (!length || start + length > buffer.length) throw Error('Truncated Lite BIN config')
  const config = JSON.parse(buffer.subarray(start, start + length).toString('utf8'))
  if (config.app?.bundleName !== buffer.subarray(5, record).toString('utf8')) throw Error('Lite BIN/config bundle names differ')
  return config
}
