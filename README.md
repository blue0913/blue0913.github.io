# 智理环宇 · AI·PHYSICA

个人主页与完整科研入门指南，适配电脑和手机。

- 65 个指南小节、34 幅插图、15 张表格。
- 全文检索、资源速查、章节链接、图片预览、本地收藏。
- 原著署名：Chaos公社；版本：2026年8月 · V1.0。

## 公开版本说明

公开版本不包含 C.5 节的网盘分享地址与提取码，软件与课程请通过前文列出的官方渠道获取。其余 64 个小节、34 幅插图和 15 张表格与原版一致。

## GitHub Pages 发布

上传本目录中的所有文件，保持 index.html 位于仓库根目录。

仓库 Settings → Pages → Build and deployment：

1. Source 选择 Deploy from a branch。
2. Branch 选择 main，文件夹选择 / (root)。
3. 点击 Save，等待 GitHub 完成部署。

网站地址：https://blue0913.github.io/ 。发布进度与结果可在仓库 Actions 中查看。

## 自定义域名

可在拥有 chaosgongshe.com 后设置 www.chaosgongshe.com。先在 GitHub 个人 Settings → Pages 验证域名，再在仓库 Pages 的 Custom domain 填写 www.chaosgongshe.com 并保存，最后去域名管理平台添加：

| 类型 | 主机记录 | 目标 |
| --- | --- | --- |
| CNAME | www | blue0913.github.io |

目标值不带 https://，也不带仓库名或路径。DNS 检查和证书签发完成后打开 Enforce HTTPS。

当前未预先加入 CNAME 文件，以便在域名购买和配置完成前正常使用 GitHub 免费网址。

官方说明：https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site

## 本地预览与修改

这是无需构建的静态网站。通过本地 HTTP 服务器预览，勿直接双击 HTML。界面在 index.html、styles.css、app.js；指南在 data/guide.json；图片与链接解析模块在 assets/。收藏和阅读偏好仅保存在当前浏览器。
