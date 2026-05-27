# SSE Stream Formatter

一个现代化的 Server-Sent Events (SSE) 流数据解析和格式化工具，支持深度 JSON 解析、实时流模拟和 URL 参数导入。

![SSE Stream Formatter](https://img.shields.io/badge/SSE-Stream%20Formatter-blue)
![Next.js](https://img.shields.io/badge/Next.js-15.2.4-black)
![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.4.17-38B2AC)

## ✨ 功能特性

### 📊 强大的解析能力
- **SSE 流解析**：完整支持 Server-Sent Events 协议格式
- **深度 JSON 解析**：自动识别并解析嵌套的 JSON 字符串
- **多层次数据处理**：递归解析复杂的数据结构
- **解析状态标记**：清晰显示哪些字段被成功解析

### 🎯 直观的用户界面
- **双视图模式**：支持格式化视图和原始 JSON 视图
- **折叠式输入区**：节省空间，专注于结果展示
- **实时解析指示**：显示解析状态和已解析字段
- **响应式设计**：完美适配桌面和移动设备

### 🔧 便捷的工具功能
- **URL 参数导入**：通过 `?content=` 参数直接导入数据
- **文件上传**：支持 `.txt`、`.log`、`.sse` 文件导入
- **实时流模拟**：内置多种 SSE 事件类型的模拟数据
- **一键操作**：复制 JSON、下载文件、清空数据

## 🚀 快速开始

### 环境要求
- Node.js 18+ 
- pnpm (推荐) 或 npm

### 安装步骤

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd sse-parsed
   ```

2. **安装依赖**
   ```bash
   pnpm install
   # 或
   npm install
   ```

3. **启动开发服务器**
   ```bash
   pnpm dev
   # 或
   npm run dev
   ```

4. **访问应用**
   
   打开浏览器访问 [http://localhost:3000](http://localhost:3000)

## 📖 使用指南

### 基本使用

1. **手动输入**
   - 在输入框中粘贴 SSE 流数据
   - 点击"Format SSE Data"按钮进行解析

2. **文件上传**
   - 点击"Upload"按钮选择文件
   - 支持 `.txt`、`.log`、`.sse` 格式

3. **模拟数据**
   - 点击"Simulate Stream"生成示例数据
   - 自动演示各种 SSE 事件类型

### URL 参数功能

通过 URL 参数可以直接导入和解析 SSE 数据：

```
https://yourapp.com/?content=<URL编码的SSE数据>
```

**示例：**
```
https://yourapp.com/?content=data%3A%20%7B%22message%22%3A%20%22Hello%20World%22%7D%0A%0A
```

页面加载时会自动：
- 提取 `content` 参数
- 进行 URL 解码
- 填充到输入框
- 触发自动解析

### SSE 数据格式

支持标准的 SSE 格式：

```
event: message
data: {"type": "chat", "content": "Hello"}

data: {"status": "processing"}

event: error
data: {"error": "Something went wrong"}
```

## 🔍 深度解析功能

### 嵌套 JSON 处理

工具会自动识别和解析字符串中的 JSON 数据：

**输入：**
```
data: {"config": "{\"theme\": \"dark\", \"lang\": \"zh-CN\"}"}
```

**解析结果：**
```json
{
  "config": {
    "theme": "dark",
    "lang": "zh-CN"
  },
  "_parsedFields": ["config"]
}
```

### 解析状态标记

- `_isParsed`: 表示数据是否成功解析为 JSON
- `_isDeepParsed`: 表示是否包含深度解析的字段
- `_parsedFields`: 列出所有被解析的字段路径
- `_rawData`: 保留原始数据用于对比

## 🛠️ 技术栈

- **框架**: Next.js 15.2.4
- **UI库**: React 19
- **样式**: Tailwind CSS 3.4.17
- **组件库**: Radix UI
- **图标**: Lucide React
- **语言**: TypeScript 5
- **构建工具**: PostCSS, Autoprefixer

## 📦 项目结构

```
sse-parsed/
├── app/                    # Next.js App Router
│   ├── page.tsx           # 主页面组件
│   ├── layout.tsx         # 布局组件
│   └── globals.css        # 全局样式
├── components/            # UI组件
│   ├── ui/               # Radix UI组件
│   └── theme-provider.tsx # 主题提供者
├── lib/                  # 工具函数
│   └── utils.ts          # 通用工具
├── hooks/                # React Hooks
├── public/               # 静态资源
└── styles/               # 样式文件
```

## 🔨 构建和部署

### 构建生产版本
```bash
pnpm build
# 或
npm run build
```

### 启动生产服务器
```bash
pnpm start
# 或
npm start
```

### 部署到 Vercel
```bash
npx vercel --prod
```

## 🎨 自定义配置

### 主题定制
项目使用 Tailwind CSS v4，可以在 `app/globals.css` 的 `@theme inline` 中自定义主题：

```css
@theme inline {
  --color-brand: var(--brand);
}

:root {
  --brand: hsl(0 0% 9%);
}

.dark {
  --brand: hsl(0 0% 98%);
}
```

### 组件定制
所有 UI 组件都可以在 `components/ui/` 目录中进行自定义。

## 🐛 故障排除

### 常见问题

1. **模块找不到错误**
   ```bash
   pnpm install
   ```

2. **端口占用**
   ```bash
   pnpm dev -- -p 3001
   ```

3. **构建失败**
   ```bash
   pnpm clean
   pnpm install
   pnpm build
   ```

## 🤝 贡献指南

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目基于 MIT 许可证开源。详见 [LICENSE](LICENSE) 文件。

## 🙏 致谢

- [Next.js](https://nextjs.org/) - React 框架
- [Radix UI](https://www.radix-ui.com/) - 无障碍 UI 组件
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架
- [Lucide](https://lucide.dev/) - 图标库

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 创建 [Issue](../../issues)
- 提交 [Pull Request](../../pulls)

---

⭐ 如果这个项目对您有帮助，请给它一个星标！
