# 图标资源

小程序里的描边图标。规格统一：`24×24` 网格、`fill="none"`、圆角端点、颜色直接写在文件里。

## 为什么颜色写死

小程序的 `<image>` 不继承 `currentColor`，同一个文件没法随文字变色。所以按用途拆成不同颜色的文件：

| 文件 | 颜色 | 用在哪 |
| --- | --- | --- |
| `plus-white.svg` | `#ffffff` | 底栏中间的发布按钮 |
| `plus-green.svg` | `#41775b` | 下单页「添加常用配送地址」 |
| `check-white.svg` | `#ffffff` | 地址卡片选中角标 |
| `x-muted.svg` | `#55544f` | 发布面板关闭（浅色） |
| `x-light.svg` | `#edf1ed` | 发布面板关闭（深色） |

## 来源与许可

图形取自 [Lucide](https://lucide.dev) `lucide-static@0.460.0`，**ISC 许可**，可商用，保留版权声明即可。

只做了三件事：去掉 `class`、把 `stroke` 从 `currentColor` 换成具体颜色、把 `stroke-width` 调到和项目原有图标一致（1.7–2.4）。

## 加新图标

1. 从 `https://unpkg.com/lucide-static@0.460.0/icons/<名字>.svg` 取原文件。
2. 压成一行，`stroke` 换成目标颜色，`stroke-width` 按用途定（大按钮 2，小角标 2.4）。
3. 存到本目录，在 WXML 里用 `<image class="..." mode="aspectFit" src="/assets/icons/<名字>.svg"/>`。
4. 尺寸用 WXSS 控制，别依赖图片自身宽高；需要内缩就给它 `padding` + `box-sizing:border-box`。

`tests/icons.test.js` 会检查每个被引用的图标文件都存在、都是 24×24 且颜色已写死，所以打错文件名会直接测试失败。
