# 🌙 月光空间 Moonspace v4

纯 HTML/CSS/JS 前端 + Node.js 后端，个人轻量社交空间。

## 功能

- 📝 动态发布（支持图片、心情、位置、公开/私密切换）
- 🎵 网易云音乐（搜索/歌单/歌词/VIP播放/每日推荐）
- ☁️ 云盘（上传/下载/分享/密码保护）
- 💬 留言板 + 悄悄话 + 私信（支持文件发送）
- 🎯 签到积分 + 成就系统 + 年度报告
- 🔒 邮箱注册/登录 + 密码修改（验证码/旧密码双重验证）
- 📱 响应式设计，移动端适配

## 快速开始

```bash
# 安装依赖
npm install

# 配置邮件服务（注册/验证码用）
cp .env.example .env
# 编辑 .env 填入 SMTP 信息

# 配置音乐Cookie（可选，需网易云VIP账号）
# 将 MUSIC_U cookie 写入 start.sh 的 NETEASE_MUSIC_U 变量

# 启动
node server.js
# 或
pm2 start server.js --name zone
```

## 结构

```
├── server.js          # 后端 Express 服务
├── package.json
├── music-precache.js  # 音乐预缓存脚本
├── public/
│   ├── index.html     # 单页入口
│   ├── css/style.css  # 全局样式
│   └── js/            # 模块化前端
│       ├── config.js  # 配置
│       ├── utils.js   # 工具函数
│       ├── auth.js    # 登录注册
│       ├── nav.js     # 导航
│       ├── feed.js    # 动态流
│       ├── music.js   # 音乐播放器
│       ├── social.js  # 社交（私信/用户页/广场）
│       ├── profile.js # 设置/个人资料/云盘
│       ├── extra.js   # 成就/运势
│       ├── player.js  # 播放器UI
│       └── main.js    # 入口
└── data/              # 数据目录（运行时生成）
```

## 技术栈

- **前端**: 原生 HTML/CSS/JS（12模块）
- **后端**: Node.js + Express + express-session
- **存储**: JSON 文件
- **音乐**: NeteaseCloudMusicApi v4
- **邮件**: Nodemailer
- **文件上传**: Multer

## 许可证

MIT License
