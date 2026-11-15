// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
const bridge = vi.hoisted(() => ({ status: vi.fn(), addListener: vi.fn(), configure: vi.fn(), connect: vi.fn() }))
vi.mock('@capacitor/core', () => ({ registerPlugin: () => bridge }))
import HuaweiWatchSettings from './HuaweiWatchSettings.jsx'
let host, root
const peer = 'ch.example.fit_BJc8JAa9rJKfqzas/d1BzWZrBv8+ECYLetB9fK0Zo1azvpUTL6izrUJNzYsYQI0ozMEMOOpYF9GmMB/ppUEBC4c='
beforeEach(() => {
  localStorage.clear(); globalThis.IS_REACT_ACT_ENVIRONMENT = true
  bridge.status.mockResolvedValue({ bundleName: 'ch.example.fit', fingerprint: peer })
  bridge.configure.mockResolvedValue(); bridge.connect.mockResolvedValue()
  bridge.addListener.mockResolvedValue({ remove: vi.fn() })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.clearAllMocks() })
it('loads identities and authorizes only after the user connects', async () => {
  await act(async () => root.render(<HuaweiWatchSettings />))
  expect(bridge.connect).not.toHaveBeenCalled()
  expect(host.querySelector('input[aria-label="手表应用包名"]').value).toBe('ch.example.fit')
  await act(async () => host.querySelector('button.btn').click())
  expect(bridge.configure).toHaveBeenCalledWith({ bundleName: 'ch.example.fit', fingerprint: peer })
  expect(host.querySelector('input[aria-label="手表签名证书指纹"]').value).toBe(peer)
  expect(host.textContent).toContain('手表应用指纹（包名与公钥）')
  expect(host.textContent).not.toContain('显示心率')
  expect(bridge.connect).toHaveBeenCalledOnce()
  expect(host.textContent).toContain('已注册通信')
})
it('shows authorization failure and permits retry', async () => {
  bridge.connect.mockRejectedValueOnce(Error('Permission denied'))
  await act(async () => root.render(<HuaweiWatchSettings />))
  await act(async () => host.querySelector('button.btn').click())
  expect(host.textContent).toContain('Permission denied'); expect(host.querySelector('button.btn').disabled).toBe(false)
})
it('keeps foreground haptics available after retiring the watch system notification feature', async () => {
  bridge.status.mockResolvedValue({ restNotifications: true, restNotificationExact: false })
  await act(async () => root.render(<HuaweiWatchSettings />))
  expect(host.textContent).toContain('休息结束震动')
  expect(host.textContent).not.toContain('休息结束系统通知')
  expect(host.textContent).not.toContain('测试手表通知')
  expect(host.textContent).not.toContain('允许准时提醒')
})
it('says which half of the link is missing, and refreshes it', async () => {
  bridge.status.mockResolvedValue({ paired: true, installed: false, configured: true })
  await act(async () => root.render(<HuaweiWatchSettings />))
  expect(host.textContent).toContain('手表已连接')
  expect(host.textContent).toContain('手表应用未应答')
  bridge.status.mockResolvedValue({ paired: true, installed: true, configured: true })
  const refreshButton = [...host.querySelectorAll('button')].find(b => b.textContent === '刷新状态')
  await act(async () => refreshButton.click())
  expect(host.textContent).toContain('手表应用已应答')
})

it('updates the handshake status from native events without overwriting edited identity fields', async () => {
  let stateChanged
  const remove = vi.fn()
  bridge.addListener.mockImplementation(async (name, fn) => { if (name === 'watchState') stateChanged = fn; return { remove } })
  bridge.status.mockResolvedValue({ paired: true, installed: false, configured: true, bundleName: 'ch.example.fit' })
  await act(async () => root.render(<HuaweiWatchSettings />))
  const input = host.querySelector('input[aria-label="手表应用包名"]')
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'ch.edited.fit')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    stateChanged({ paired: true, installed: true, configured: true, bundleName: 'ch.example.fit', receiverRegistered: true })
  })
  expect(host.textContent).toContain('手表应用已应答')
  expect(host.textContent).toContain('接收器已就绪')
  expect(input.value).toBe('ch.edited.fit')
  await act(async () => root.unmount())
  expect(remove).toHaveBeenCalled()
  root = createRoot(host)
})

it('removes a native listener whose registration finishes after leaving the page', async () => {
  let finish
  const remove = vi.fn()
  bridge.addListener.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  await act(async () => root.render(<HuaweiWatchSettings />))
  await act(async () => root.unmount())
  await act(async () => finish({ remove }))
  expect(remove).toHaveBeenCalledOnce()
  root = createRoot(host)
})

it('keeps runtime detection, protocol response and checked authorization visible separately', async () => {
  bridge.status.mockResolvedValue({ paired: true, installed: false, configured: true, receiverRegistered: true,
    managerGranted: true, lastPingCode: 202, lastSendCode: 206, receivedPackets: 0,
    deviceName: 'HUAWEI WATCH FIT 5 Pro', p2pCapability: 0 })
  await act(async () => root.render(<HuaweiWatchSettings />))
  expect(host.textContent).toContain('连接权限已授权')
  expect(host.textContent).toContain('应用探测 202（运行中）')
  expect(host.textContent).toContain('手表应用未应答')
  expect(host.textContent).toContain('通信能力支持')
})
