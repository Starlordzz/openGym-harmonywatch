// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
const bridge = vi.hoisted(() => ({ status: vi.fn(), configure: vi.fn(), connect: vi.fn() }))
vi.mock('@capacitor/core', () => ({ registerPlugin: () => bridge }))
import HuaweiWatchSettings from './HuaweiWatchSettings.jsx'
let host, root
beforeEach(() => {
  localStorage.clear(); globalThis.IS_REACT_ACT_ENVIRONMENT = true
  bridge.status.mockResolvedValue({ bundleName: 'ch.example.fit', fingerprint: 'A'.repeat(64) })
  bridge.configure.mockResolvedValue(); bridge.connect.mockResolvedValue()
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.clearAllMocks() })
it('loads identities and authorizes only after the user connects', async () => {
  await act(async () => root.render(<HuaweiWatchSettings />))
  expect(bridge.connect).not.toHaveBeenCalled()
  expect(host.querySelector('input[aria-label="手表应用包名"]').value).toBe('ch.example.fit')
  await act(async () => host.querySelector('button.btn').click())
  expect(bridge.configure).toHaveBeenCalledWith({ bundleName: 'ch.example.fit', fingerprint: 'A'.repeat(64) })
  expect(bridge.connect).toHaveBeenCalledOnce()
  expect(host.textContent).toContain('已注册通信')
})
it('shows authorization failure and permits retry', async () => {
  bridge.connect.mockRejectedValueOnce(Error('Permission denied'))
  await act(async () => root.render(<HuaweiWatchSettings />))
  await act(async () => host.querySelector('button.btn').click())
  expect(host.textContent).toContain('Permission denied'); expect(host.querySelector('button.btn').disabled).toBe(false)
})
