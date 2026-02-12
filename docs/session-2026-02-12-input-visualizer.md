# Session: Add Virtual Keyboard & Mouse Visualizer

**Date:** 2026-02-12
**Branch:** main

## Goal

在右下角添加半透明的虚拟键盘和鼠标，实时响应用户的物理按键和鼠标操作。

## Changes

### New Files

#### 1. `src/data/keyboardLayout.ts`
- 定义 `KeyDef` 接口（label, codes, width）
- 导出 `KEYBOARD_LAYOUT` 常量：5 行按键布局（Esc+数字行、QWERTY、Home 行、Shift 行、修饰键+空格）
- 使用 `KeyboardEvent.code`（物理键位）而非 `key`（字符），确保 Shift+A 同时高亮两个键

#### 2. `src/components/InputVisualizer.tsx`
- 独立组件，不与 Terminal 共享状态
- `pressedKeys: Set<string>` — 追踪按下的键码
- `pressedButtons: Set<number>` — 追踪鼠标按钮（0=左, 1=中, 2=右）
- `scrollActive: boolean` — 滚轮短暂闪烁效果（150ms 超时）
- 事件监听挂在 `window` 上，使用 capture 阶段确保始终能捕获
- `window.blur` 时清空所有状态，防止按键"粘住"
- `pointer-events: none` 确保不拦截任何点击
- 键盘：遍历 `KEYBOARD_LAYOUT` 渲染行和键，通过 CSS 变量 `--key-width` 控制宽度
- 鼠标：左/中/右按钮 + 圆角矩形鼠标体

#### 3. `src/components/InputVisualizer.css`
- `position: fixed; bottom: 16px; right: 16px; z-index: 1000`
- `opacity: 0.35` — 半透明不干扰终端内容
- `pointer-events: none` — 点击穿透
- 每个键 `--key-unit: 24px`，通过 `calc(var(--key-width) * var(--key-unit))` 计算宽度
- `.active` 状态：绿色背景（`--success-color`）+ 发光效果（`box-shadow`），0.05s 过渡
- 鼠标造型：三个按钮区（左/中/右）+ 圆底身体
- `@media (max-width: 600px)` 隐藏

### Modified Files

#### 4. `src/App.tsx`
- 导入 `InputVisualizer`
- 用 `<>` Fragment 包裹 `<Terminal />` 和 `<InputVisualizer />`

## Verification

- `npx tsc --noEmit` 类型检查通过
- `npm run dev` 启动后：
  - 右下角可见半透明键盘和鼠标
  - 按键时对应虚拟键高亮（绿色 + 发光）
  - 鼠标点击时对应按钮高亮
  - 滚轮滚动时中键区域闪烁
  - 点击键盘覆盖区域仍可正常聚焦终端输入（pointer-events: none）
