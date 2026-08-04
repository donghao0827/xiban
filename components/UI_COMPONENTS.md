# 囍伴公共组件

所有组件已在 `app.json` 全局注册，页面可直接使用。

## ui-section

页面分区标题。支持 `title`、`meta`、`dot`、`link`，点击右侧入口触发 `action`。

## ui-button

统一按钮。`type` 支持 `primary / secondary / outline / text`，`size` 支持 `large / medium / small`，点击触发 `action`。

## ui-tag

状态标签。`tone` 支持 `pink / orange / green / purple / gray`，可通过 `filled` 使用实色状态。

## ui-progress

统一进度条。使用 `value` 设置百分比，`tone` 支持 `pink / orange / green / purple / blue`。

## ui-list-item

统一列表项。支持图标、标题、说明、右箭头及 `leading / trailing` 插槽，点击触发 `tap`。

## ui-sheet

统一底部弹层。支持标题、副标题、默认内容插槽与 `footer` 插槽，关闭触发 `close`。

## empty-state

统一空状态。支持图标、标题、说明和可选操作按钮，点击操作按钮触发 `action`。
