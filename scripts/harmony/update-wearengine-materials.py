#!/usr/bin/env python3
"""Update local Wear Engine review attachments; never submit an application.

Run with: uv run --with openpyxl --with pillow python scripts/harmony/update-wearengine-materials.py
Artifact Tool is unavailable in this WSL session, so openpyxl preserves the supplied templates.
"""
from copy import copy
from pathlib import Path
import hashlib
import json
import shutil

from openpyxl import load_workbook
from openpyxl.drawing.image import Image as SheetImage
from openpyxl.styles import Alignment, Font
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'harmonywatch/artifacts/outputs/opengym-wearengine-resubmission-20261031'
OUT = ROOT / 'harmonywatch/artifacts/outputs/opengym-wearengine-notify-20261101'
OUT.mkdir(parents=True, exist_ok=True)
shutil.copytree(SOURCE / 'images', OUT / 'images', dirs_exist_ok=True)
FONT = Path('/mnt/c/Windows/Fonts/msyh.ttc')
if not FONT.exists():
    FONT = Path('/tmp/we-img/msyh.ttc')


def diagram(name, title, steps, note):
    # Original process diagram, not an edited screenshot or a simulated Huawei dialog.
    width, height = 1080, 180 + len(steps) * 220 + 180
    im = Image.new('RGB', (width, height), '#f6f8f7')
    draw = ImageDraw.Draw(im)
    def font(size):
        return ImageFont.truetype(str(FONT), size)
    def lines(text, size, max_width):
        output, line = [], ''
        for ch in text:
            if ch == '\n':
                output.append(line); line = ''; continue
            if draw.textlength(line + ch, font=font(size)) > max_width:
                output.append(line); line = ch
            else:
                line += ch
        return output + [line]
    draw.rectangle((0, 0, width, 150), fill='#142b20')
    draw.text((42, 24), title, font=font(36), fill='white')
    draw.text((42, 87), '流程示意 · 非授权成功截图 · 非同步实测结果', font=font(27), fill='#ffe6a7')
    for index, (heading, body) in enumerate(steps):
        y = 180 + index * 220
        draw.rounded_rectangle((36, y, width - 36, y + 180), radius=16, fill='white', outline='#c7d7cd', width=2)
        draw.text((62, y + 16), str(index + 1) + '. ' + heading, font=font(31), fill='#185a35')
        for j, line in enumerate(lines(body, 27, width - 128)):
            draw.text((64, y + 65 + j * 36), line, font=font(27), fill='#26352c')
        if index < len(steps) - 1:
            draw.text((520, y + 182), '↓', font=font(30), fill='#185a35')
    y = 180 + len(steps) * 220
    for j, line in enumerate(lines(note, 25, width - 84)):
        draw.text((42, y + j * 35), line, font=font(25), fill='#565e59')
    im.save(OUT / 'images' / (name + '.jpg'), quality=94)


diagram('P04', 'P04  训练记录回传与确认', [
    ('手表记组', '用户完成一组；应用先把记录写入手表本地待同步队列。'),
    ('恢复通信后发送', '发送带唯一事件 ID 的训练记录；断连期间保留待同步状态。'),
    ('手机保存并去重', '手机按事件 ID 去重、保存到对应训练，再返回确认消息。'),
    ('手表收到确认', '从待同步队列移除该记录，避免重复记组。'),
], '本图说明应用设计。尚未取得手机接收手表记录成功的真机画面，不表示已完成端到端验证。')
diagram('P05', 'P05  休息结束通知授权路径', [
    ('进入 HUAWEI FIT 设置', '手机 openGym → 设置 → HUAWEI FIT；在华为运动健康中保持手表连接。'),
    ('授权并连接', '核对手表包名与证书指纹，点击“授权并连接”，请求 DEVICE_MANAGER。'),
    ('开启休息结束系统通知', '用户主动开启同名开关；应用请求 DEVICE_MANAGER 与 NOTIFY。'),
    ('按真实授权结果处理', '两项权限均获授予才开启功能；取消、拒绝或服务未获批时显示错误。'),
    ('测试手表通知', '开启后显示“测试手表通知”；实际送达、声音和振动需要在手表确认。'),
], '依据现有应用代码绘制，非华为授权弹窗。平台服务尚未获批；未取得 NOTIFY 真机授权截图，后续补充真实画面。')
diagram('U01', 'U01  手机、手表与休息提醒', [
    ('训练同步：DEVICE_MANAGER', '手机下发计划、训练快照与动作动画；手表回传组记录和训练结果。'),
    ('断连与恢复', '手表本地保存未确认记录，恢复通信后重发；手机去重、保存并确认。'),
    ('休息提醒：NOTIFY', '用户开启系统通知后，手表向手机发送休息截止时间；手机安排定时任务。'),
    ('到点向连接的手表发通知', '手机调用 Wear Engine 模板通知；声音与振动遵循手表系统设置。'),
], '后台实时通信、提醒送达与准时性待目标设备实测。精确闹钟不可用时可能延迟；断连、勿扰或未佩戴会影响提示。')

USAGE = '''【手机下发训练】用户主动授权并连接后，手机通过 P2P 消息发送动作、组数、重量、次数、计时、上次成绩、热身、超级组和单侧训练快照；动作动画通过文件传输发送。手表收到后返回确认。
【手表回传记录】用户记组或结束训练时，手表先把记录写入本地待同步队列，再发送给手机。手机按事件 ID 去重、保存后返回确认；手表收到确认才移除待同步记录。
【断连与恢复】手机未运行、连接不可用或发送失败时，手表保留记录；重新打开手机应用时检查连接，恢复后重试。不会仅凭发送调用成功就宣称手机已保存。
【运行条件】两端应用运行、运动健康服务及蓝牙连接正常是当前测试前提；优先在两端前台验证。手机后台实时接收与系统回收后的行为尚未完成真机验证，不写成所有设备后台均无法接收。
本权限用于确定通信目标及交换训练数据，不用于广告画像或跨应用追踪。'''
NOTIFY = '''【需求与目的】用户完成一组后，需要在休息结束时收到手表提示，以便继续下一组。
【使用方式】手机与手表连接后，用户在“设置 → HUAWEI FIT”主动开启“休息结束系统通知”。应用请求 DEVICE_MANAGER 与 NOTIFY，并检查两项授权结果。手表发送休息截止时间；手机安排定时任务，到点调用 Wear Engine NotifyClient.notify，向已连接手表发送“休息结束，开始下一组”模板通知。
【用户控制】关闭通知开关会停用并取消本应用的待发提醒；取消或拒绝授权时不启用功能。关闭功能不等同于撤销华为侧授权。
【边界】手机无需一直停留在设置页面；后台送达与准时性待实测。精确闹钟不可用时可能延迟；需要保持连接。声音与振动遵循手表设置、佩戴及勿扰状态，不能保证每次响铃。'''
AUTH = '''一、设备基础信息与训练通信（P01、P02）
1. 在华为运动健康中配对手表，保持连接；当前开发配置使用唯一一台已连接设备。
2. 打开 openGym Phone → 设置 → HUAWEI FIT。
3. 核对预填的手表包名 host.msknet.opengym.fit 与签名证书 SHA-256 指纹，点击“授权并连接”。
4. 应用调用 requestPermission(DEVICE_MANAGER)。按华为模板，Android 设备基础信息为默认授予项，不承诺出现独立弹窗。注册通信后仍需打开手表应用完成握手，不将注册成功当作计划同步成功。

二、休息结束系统通知（P05）
5. 连接手表后，由用户主动开启“休息结束系统通知”。此操作调用 requestPermission(DEVICE_MANAGER, NOTIFY)。
6. 实际授权界面由华为服务提供；按实际提示操作。仅在回调包含两项权限时开启功能；取消、拒绝或服务未获批时保留关闭状态并提示错误。
7. 开启后可点击“测试手表通知”；接口调用成功不等于已听到声音，需在手表确认。若 Android 未允许精确闹钟，页面提供“允许准时提醒”入口；不允许时提醒可能延迟。
8. 关闭“休息结束系统通知”会停用并取消待发提醒；“同步训练到手表”只控制训练下发。两者均不描述为撤销华为侧授权。

图片来源：P01、P02 为旧版手机真机入口/连接页，仅证明该部分界面。P05 是根据现有代码绘制的通知授权路径示意，非华为授权弹窗、非授权成功截图。当前尚未获平台批准，未取得 NOTIFY 真机授权画面，后续按真实结果补充。'''
CAPTIONS = '''共 11 张：P01 手机设置入口、P02 手机授权并连接页、P03 手机训练页，均为手机真机截图；P02 为既有连接页，不证明新增 NOTIFY 已授权。
W01–W05 为 FIT 5 Pro 真机截图：未同步、记组、休息待同步、结束待同步、锁定。
P04 为重新绘制的回传确认流程；P05 为通知授权路径；U01 为双端与通知流程。三图均在图内注明“流程示意”，不作为同步成功或授权成功证据。
NOTIFY 的详细用途及边界见下一行；当前实测范围与未验证项见附加说明。'''
SCOPE = '申请覆盖鸿蒙智能穿戴与鸿蒙轻量级智能穿戴；当前实测截图设备为 HUAWEI WATCH FIT 5 Pro（NKI-B29），手表实现为 liteWearable JS。其他智能穿戴型号尚未完成适配与验证，不将申请范围写作已验证兼容清单。'


def cell(ws, address, value):
    c = ws[address]
    c.value = value
    c.alignment = Alignment(vertical='top', wrap_text=True)
    f = copy(c.font)
    f.name = '微软雅黑'; f.sz = 10
    c.font = f


def put(ws, name, anchor, height):
    p = OUT / 'images' / (name + '.jpg')
    im = SheetImage(p)
    column = ''.join(ch for ch in anchor if ch.isalpha())
    width = ws.column_dimensions[column].width * 7 + 5 - 18
    scale = min(height / im.height, width / im.width)
    im.width = round(im.width * scale)
    im.height = round(im.height * scale)
    ws.add_image(im, anchor)


wb = load_workbook(SOURCE / 'openGym-WearEngine-usage-20261031.xlsx')
ws = wb['个人开发者（必填）']
if 'E9:E10' in ws.merged_cells:
    ws.unmerge_cells('E9:E10')
ws.column_dimensions['C'].max = 3
ws.column_dimensions['D'].width = 62
cell(ws, 'C6', '训练同步优先在手机与手表应用均运行时验证；连接不可用则本地保存，恢复后重试。手机后台实时接收待实测。休息通知由手机定时任务触发，具体送达与时效待验证。')
cell(ws, 'C7', SCOPE)
cell(ws, 'C9', USAGE)
cell(ws, 'B9', '设备基础信息（DEVICE_MANAGER）：获取已配对设备、连接状态、电量及应用安装状态；手机与穿戴应用双向传输消息和文件。')
cell(ws, 'D9', CAPTIONS)
cell(ws, 'E9', '当前 FIT 手表应用未实现独立从 NAS 取计划的路径，数据经手机中转。后台实时通信待实测；不将“当前未实现直连”写成设备绝对不能联网。部分智能穿戴设备具备独立联网能力，后续适配需按目标设备能力评估。当前申请 DEVICE_MANAGER 与 NOTIFY；不申请人体/运动传感器、佩戴状态或拉起对端应用。')
for col in 'ABCDE':
    ws[f'{col}10']._style = copy(ws[f'{col}9']._style)
cell(ws, 'A10', 2)
cell(ws, 'B10', '消息通知（NOTIFY）：手机向已配对且连接的穿戴设备发送模板通知。')
cell(ws, 'C10', NOTIFY)
cell(ws, 'D10', '手机入口：设置 → HUAWEI FIT → 授权并连接 → 开启“休息结束系统通知”。\nP05：授权路径示意（非实际授权弹窗）。\nU01：截止时间、手机定时与手表通知流程示意。\n尚缺平台授权弹窗真机截图及通知到达真机画面；不以 UX 示意替代实测成功证据。')
cell(ws, 'E10', '申请手机侧消息通知能力；手表无需独立申请同一 Wear Engine Scope。NOTIFY 用于提醒，不代替训练 P2P 通信。平台批准和用户授权分别处理；当前未获服务批准。')
ws.row_dimensions[6].height = 78
ws.row_dimensions[7].height = 92
ws.row_dimensions[9].height = 380
ws.row_dimensions[10].height = 310
# Preserve the official sheet structure; rebuild only its screenshot appendix.
ws._images = []
for ref, text in [('B11', '应用入口与训练（真机）'), ('B14', '手表训练过程（FIT 真机）'), ('B17', '业务流程示意（不代表实测成功）')]:
    cell(ws, ref, text); ws[ref].font = Font(name='微软雅黑', size=11, bold=True)
for name, ref in [('P01','B12'),('P02','C12'),('P03','D12'),('W01','E12'),('W02','B15'),('W03','C15'),('W04','D15'),('W05','E15'),('P04','B18'),('P05','C18'),('U01','D18')]:
    put(ws, name, ref, 430 if ref.endswith('18') else 350)
for row, height in [(12,280),(15,280),(18,340)]:
    ws.row_dimensions[row].height = height
for row in [11,14,17]:
    ws.row_dimensions[row].height = 24
for row in [13,16]:
    ws.row_dimensions[row].height = 12
ws.print_options.horizontalCentered = True
ws.sheet_properties.pageSetUpPr.fitToPage = True
ws.page_setup.orientation = 'landscape'; ws.page_setup.paperSize = ws.PAPERSIZE_A3
ws.page_setup.fitToWidth = 1; ws.page_setup.fitToHeight = 0
ws.print_area = 'A1:H18'
intro = wb['应用信息（必填）']
cell(intro, 'A2', intro['A2'].value.replace('训练计划与题程管理', '训练计划管理') + '\n\n休息结束系统通知：用户开启后，经手机向手表发送模板提醒。申请范围覆盖两类穿戴设备；当前 FIT 版本及截图不代表其他智能穿戴型号已完成适配。')
intro.row_dimensions[2].height = 320
intro._images = []
for name, ref in [('P01','A4'),('P02','A6'),('P03','A8')]:
    put(intro,name,ref,360)
    intro.row_dimensions[int(ref[1:])].height = 280
intro.print_area = 'A1:A8'
usage_path = OUT / 'openGym-WearEngine-usage-20261101.xlsx'
wb.save(usage_path)

auth = load_workbook(SOURCE / 'openGym-WearEngine-authorization-20261031.xlsx')
a = auth['Sheet1']
cell(a, 'B2', AUTH); a.row_dimensions[2].height = 400
a._images = []
for row, name, caption in [(3,'P01','P01 手机真机：设置入口'),(6,'P02','P02 手机真机：既有连接页（不证明 NOTIFY 已授权）'),(9,'P05','P05 新增通知授权路径（流程示意，非华为授权弹窗）')]:
    cell(a, f'B{row}', caption); a[f'B{row}'].font = Font(name='微软雅黑',size=11,bold=True)
    a.row_dimensions[row].height = 24
    put(a,name,f'B{row+1}',490)
    a.row_dimensions[row+1].height = 380
    a.row_dimensions[row+2].height = 15
a.print_area = 'A1:B11'
a.sheet_properties.pageSetUpPr.fitToPage = True
a.page_setup.fitToWidth = 1; a.page_setup.fitToHeight = 0
auth_path = OUT / 'openGym-WearEngine-authorization-20261101.xlsx'
auth.save(auth_path)

docs = {
 '图片说明.md': '''# 图片来源与用途（2026-11-01）

共 11 张：P01/P02/P03 为既有手机真机截图；W01–W05 为 FIT 5 Pro 真机截图；P04/P05/U01 为新绘制的流程示意，均在图内标注“非授权成功截图、非同步实测结果”。

- P01：手机设置列表的 HUAWEI FIT 入口。
- P02：既有手机连接页面，含包名、指纹及“授权并连接”。它不含新增通知开关，不能作为 NOTIFY 授权证据。
- P03：手机训练内容。
- W01：尚未同步；W02：记组；W03：休息及待同步；W04：结束及待同步；W05：锁定。
- P04：回传、去重、保存与确认的设计流程，替换旧模拟“刚刚同步”手机画面。
- P05：按实际代码绘制的通知授权路径，包含设置入口、连接、主动开启通知、权限结果与测试通知。不是伪造的华为授权弹窗。
- U01：DEVICE_MANAGER 训练通信、离线恢复与 NOTIFY 手机定时提醒流程。

尚未取得 NOTIFY 真机授权界面、真实通知到达及真实训练回传成功画面；不把流程示意当作这些结果的证据。images 中 *-full.png 是原始手机图的保留副本，不计入本次 11 张嵌图。
''',
 '补充说明.md': '''# Wear Engine 补充说明（2026-11-01）

申请手机应用 openGym Phone（host.msknet.opengym.phone，APP ID 119569911）的 DEVICE_MANAGER 与 NOTIFY；不申请人体/运动传感器、佩戴状态或拉起对端应用。

## 训练通信

手机下发训练快照与动画；手表记组、保存并回传。训练记录先写手表本地队列，恢复通信后重试；手机按事件 ID 去重，落盘后确认。当前实现未从手表直接访问 NAS。此实现选择不代表所有穿戴设备都无法联网，其他型号的独立联网能力需按设备评估。

优先在两端应用运行、运动健康服务及蓝牙连接正常时验证。手机后台实时接收、被系统回收、蓝牙断开、补传与去重的完整真机测试尚未完成，不断言所有设备后台均不能接收。

## 休息通知

用户连接后主动开启“休息结束系统通知”，应用请求 DEVICE_MANAGER 和 NOTIFY，检查实际授权结果。手表发送截止时间，手机安排 AlarmManager 任务，到点通过 Wear Engine 模板通知提醒已连接手表。关闭通知取消待发提醒；关闭功能不等于撤销华为授权。后台送达、准时性和声音待实测；精确闹钟不可用可能延迟，断连、静音、勿扰、未佩戴影响效果。

## 设备范围与证据

申请范围选鸿蒙智能穿戴及轻量级智能穿戴。当前实现与实测截图为 FIT 5 Pro（NKI-B29），不表示其他智能穿戴型号已适配。申请范围、实现范围与已验证设备分别表述，不在网页功能说明中加入无关开发细节。

P01–P03、W01–W05 是既有真机界面；P04/P05/U01 是明确标注的流程示意。NOTIFY 真机授权、通知到达、真实训练回传及其他智能穿戴兼容均未验证。Scope unauthorized 只说明 Scope 校验未通过，不能单凭错误字符串判定服务端是否收到请求或当前审批状态；审批以开发者中心为准。

## 来源和许可

基于 Duarte Santos 的 openGym：https://github.com/DuarteSantos8/openGym；第三方华为 FIT / HarmonyOS 适配，AGPL-3.0-or-later。没有发布应用或修改 NAS。
''',
 '审核意见对照表.md': '''# 补交检查（2026-11-01）

| 项目 | 本次处理 | 状态 |
|---|---|---|
| 权限与网页一致 | DEVICE_MANAGER、NOTIFY 各一行，删除“不申请 NOTIFY” | 已修正 |
| 通知使用目的 | 休息结束、手机定时、连接手表、用户控制及条件 | 已补 |
| 用户授权路径 | 补开启通知、请求两项权限、检查结果及关闭流程 | 已补文字和 P05 示意 |
| 通知授权真机截图 | 未获准前不伪造成功画面 | 待补真实画面 |
| 界面/UX | 8 张真机界面 + 3 张明确标注的流程示意 | 共 11 张 |
| 手机后台行为 | 描述当前设计及待实测项，不作绝对判断 | 已修正 |
| 设备范围 | 申请两类；已验证图仅 FIT，不宣称全部兼容 | 已统一 |
| 包名、APP ID、作者署名 | 保留原值、原作者及上游链接 | 待导出后独立核对 |
| 表格版面 | 使用 Excel 导出检查文字和嵌图 | 见 VERIFICATION.json |
| 重新提交 | 本次不点击服务提交，不上架 | 未提交 |
''',
 '提交指引.md': '''# 当前附件（2026-11-01）

用途槽：openGym-WearEngine-usage-20261101.xlsx。
授权路径槽：openGym-WearEngine-authorization-20261101.xlsx。

网页选择：Android 手机应用 host.msknet.opengym.phone；设备范围“都需要支持”；开发手表应用选“是”；勾选“设备基础信息”和“消息通知”。不勾选拉起对端或传感器能力。

网页功能说明只写训练计划、记组、动画、离线保存、同步及休息通知。包名及 APP ID 沿用登记值，不另建应用。服务申请不是应用市场上架。

11 张图已嵌入用途表。P05 是通知授权操作示意，尚缺真实华为授权界面和送达画面；现阶段不把服务未批准时无法取得的成功画面伪造成已验证结果。若审核明确要求实际授权界面，按真实可达状态补拍。

本次仅检查并修改本地材料，不上传网页附件，不提交申请。旧版材料保留在相邻 20261031 目录，避免误传旧附件。
''',
 '待用户补充.md': '''# 仍需真实设备验证的内容

材料编辑已完成，不要求提供密码、验证码或私钥。

1. 当前手机版本“休息结束系统通知”开关及实际华为 NOTIFY 授权界面。审批拦截如实记录，不伪造授权成功。
2. 平台获批后，通知到达 FIT 的画面和声音/振动结果；后台和准时性按实际状态记录。
3. 训练计划真实下发及同一训练记录回传、确认后的画面。
4. 手机退后台、进程回收、蓝牙断开及恢复后的记录保存、补传和去重测试。
5. 如果适配其他智能穿戴，补对应型号、系统版本与实际结果；当前不把申请两类写成两类均已验证。

这些不是本次已完成的测试。审批状态以开发者中心为准；Scope unauthorized 本身不能唯一证明当前审批状态。
''',
 '申请状态.md': '''# 本次材料状态（2026-11-01）

旧申请曾被要求补充材料；本次将准备范围更新为 DEVICE_MANAGER + NOTIFY。两份 Excel、11 张嵌图与配套说明在本目录，原 20261031 材料保留不动。

手机：openGym Phone；包名 host.msknet.opengym.phone；APP ID 119569911。
手表：host.msknet.opengym.fit；当前实现与截图设备为 FIT 5 Pro / NKI-B29。
申请两类穿戴服务范围，其他智能穿戴兼容未验证。

本次没有上传或替换网页附件，没有提交服务申请，没有发布应用。本地文件校验见 VERIFICATION.json；未获批前不写“授权/同步/通知成功”。
''',
}
for name, content in docs.items():
    (OUT / name).write_text(content, encoding='utf-8')

additional = wb['补充说明（必填）']
for row in (2,3,4):
    additional[f'A{row}'].alignment = Alignment(vertical='center',wrap_text=True)
# The official labels are longer than their fixed column; keep all questions readable.
wb.save(usage_path)

verification = {'updatedAt': '2026-11-01', 'permissions': ['DEVICE_MANAGER','NOTIFY'], 'imageCount':11,
 'sourceMaterialsPreserved':True,'notifyAuthScreenshotAvailable':False,'hardwareNotifyVerified':False,
 'smartWearableCompatibilityVerified':False,'applicationSubmitted':False,'webAttachmentsReplaced':False,
 'files':{p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in (usage_path, auth_path)}}
(OUT/'VERIFICATION.json').write_text(json.dumps(verification,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(verification,ensure_ascii=False,indent=2))
