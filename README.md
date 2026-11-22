# Fatfox Lite 新标签页

一个只有新标签页的极简 Chrome 扩展：**本地运行、不联网、无追踪、无 AI**。

它是对原「Fatfox 新标签页」的重写。原扩展把整个新标签页放在 `goosetab.com` 的远程 iframe 里，本地包只负责把它塞进页面，所以界面上任何一处都改不了；同时还内置了 FingerprintJS 设备指纹、把 `chrome.history` 里能解析出的搜索词上报、申请全站 `host_permissions`。这个版本把这些全部去掉，用一份本地 HTML 把界面重做。

## 功能

| 模块 | 说明 |
| --- | --- |
| 时钟 | 时 / 分 / 秒，12 或 24 小时制，可开关 |
| 日期 | 公历日期 + 星期 + 农历（含节日、二十四节气之外的常见农历节日与除夕） |
| 搜索 | Bing / 百度 / Google / DuckDuckGo / 搜狗 / 360，点搜索框左边的引擎名即可切换 |
| 快捷图标 | 自建列表，可增删排序；图标优先用扩展的 `favicon` 权限取，取不到回退到站点自己的 `/favicon.ico` |
| 底部 Dock | 常用站点，同样的自建列表与排序 |
| 便签 | 边写边自动保存，内容只存在本机 |
| 设置面板 | 壁纸 / 图标 / 搜索 / 时间 / 便签 / 重置 / 问题反馈 七个分页 |
| 壁纸 | 内置樱花视频；可选本地视频或图片、粘贴剪贴板里的图片、粘图片/视频直链；带遮罩浓度调节 |

界面尺寸全部用 `clamp()` 写成流式，从 1920 宽的桌面到 390 宽的手机视口都按同一套规则缩放，不会溢出也不需要额外的断点。

## 安装

1. 下载或克隆本仓库。
2. 打开 `chrome://extensions/`，右上角开启「开发者模式」。
3. 点「加载已解压的扩展程序」，选择仓库根目录（含 `manifest.json` 的那一层）。
4. 新开一个标签页即可。

> 这个版本不上架应用商店，所以不需要打包成 `.crx`，也不需要 `update_url`。

## 权限

只申请两个：

- `storage` —— 存设置和便签。
- `favicon` —— 用 Chrome 自带的 `/_favicon/` 接口取图标，避免直接去请求每个站点的 favicon 而暴露访问记录。

没有 `tabs`、没有 `history`、没有 `scripting`、没有 `host_permissions`，没有后台 service worker，没有 content script。

## 目录

```
manifest.json          MV3 清单
newtab.html            新标签页唯一入口
src/newtab.css         样式（流式布局 + 玻璃拟态）
src/newtab.js          全部逻辑：设置读写、时钟、搜索、图标、Dock、便签、设置面板
src/lunar.js           农历换算（内置 1900 年起的 200 年表，无外部依赖）
assets/icons/          16/32/48/128 图标
assets/wallpapers/     内置樱花壁纸（cherry.mp4 与封面 cherry.jpg）
_responsive.html       自查用：一页并列 4 档视口，判断自适应是否成立
```

## 已知限制

- 壁纸存在 `chrome.storage.local` 里，单个键大约 10 MB，转成 base64 后膨胀约 33%，所以超过约 7 MB 的原图建议改用直链。
- 少数站点没有可以抓的 `/favicon.ico`（或返回的不是图片），此时图标格会显示站名首字母。
- 农历数据由 `src/lunar.js` 内置的表算，可覆盖 1900–2100。

## 反馈

请到 [Issues](https://github.com/iJiangli/fatfox-lite/issues) 提，设置面板里的「问题反馈」直通新建 issue 页面。

## 许可

MIT，见 [LICENSE](LICENSE)。
