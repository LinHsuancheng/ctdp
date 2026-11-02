# 同步服务器部署

把 `server/` 部署到自己的 VPS：Node 服务只监听本机 `127.0.0.1:8787`，由 Caddy 对外提供 HTTPS（自动申请和续期 Let's Encrypt 证书）。同一个服务还托管手机端网页程序：手机打开 `https://你的子域名/` 就是手机端。

```
手机 / 电脑 ──HTTPS──> Caddy (:443) ──> ctdp-sync (127.0.0.1:8787) ──> /var/lib/ctdp-sync/ctdp.db
```

下面的命令以 Debian / Ubuntu 为例，用 root 或 sudo 执行。`your-subdomain.example.org` 全部换成你的子域名。

## 1. 前提

- 子域名已指向 VPS 的 IP：`nslookup your-subdomain.example.org` 能查到 VPS 的 IP。
- 防火墙和云厂商安全组放开 **80** 和 **443**（申请证书用 80，访问用 443）。**不要**放开 8787。
- 80 和 443 没被别的程序占用：`ss -ltnp | grep -E ':(80|443)\b'` 没有输出。如果已有 nginx，见文末“已有 nginx 的情况”。

## 2. 安装 Node.js 22（≥ 22.13）

服务用到 Node 自带的 SQLite，需要 22.13 或更高的 22.x。任选一种方式安装，装好后确认：

```bash
node -v          # v22.13 以上
command -v node  # 记下路径，systemd 配置要用
```

## 3. 获取代码并构建

```bash
git clone <你的仓库地址> /opt/ctdp

# 同步服务器
cd /opt/ctdp/server
npm ci
npm run build    # 生成 server/dist/server.js

# 手机端网页程序（和桌面端共用界面代码，所以在根目录构建）
cd /opt/ctdp
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci
npm run build:web    # 生成 dist/web/
```

- 根目录是桌面端的依赖。`ELECTRON_SKIP_BINARY_DOWNLOAD=1` 跳过 Electron 本体（约 100 MB）的下载，VPS 上用不到它。
- 服务启动时会在 `/opt/ctdp/dist/web` 找网页程序。放在别处时，在 `/etc/ctdp-sync.env` 里加 `STATIC_DIR=绝对路径`。
- 没有构建网页程序也能运行，只是手机打不开页面，日志里会提示 `no phone web app at ...`。

## 4. 用户、数据目录、配置

```bash
useradd --system --home /var/lib/ctdp-sync --shell /usr/sbin/nologin ctdp
mkdir -p /var/lib/ctdp-sync
chown ctdp:ctdp /var/lib/ctdp-sync
chmod 700 /var/lib/ctdp-sync

cp /opt/ctdp/server/deploy/ctdp-sync.env.example /etc/ctdp-sync.env
chmod 600 /etc/ctdp-sync.env
openssl rand -hex 32   # 生成令牌
nano /etc/ctdp-sync.env
```

`/etc/ctdp-sync.env` 里要改两项：

| 变量 | 含义 |
|------|------|
| `CTDP_TOKEN` | 访问令牌，填上面生成的随机串。每台设备连接时都要输入它；它是唯一的保护，不要外泄 |
| `VAPID_SUBJECT` | 推送服务要求的联系方式，填 `https://你的子域名`，或 `mailto:你的邮箱`。不要留默认值，Apple 的推送服务可能拒绝 |

其余保持默认：数据放在 `/var/lib/ctdp-sync`，只监听 `127.0.0.1:8787`。

## 5. 用 systemd 常驻运行

```bash
cp /opt/ctdp/server/deploy/ctdp-sync.service /etc/systemd/system/
# 如果 `command -v node` 不是 /usr/bin/node，改 ExecStart 里的路径
nano /etc/systemd/system/ctdp-sync.service
systemctl daemon-reload
systemctl enable --now ctdp-sync
systemctl status ctdp-sync      # 应看到 active (running)
journalctl -u ctdp-sync -n 20   # 应看到 "ctdp sync server on http://127.0.0.1:8787" 和 "phone web app from /opt/ctdp/dist/web"
```

本机检查：

```bash
curl http://127.0.0.1:8787/api/health   # {"ok":true}
```

## 6. 安装 Caddy，提供 HTTPS

按 Caddy 官方文档安装（<https://caddyserver.com/docs/install>，Debian/Ubuntu 用它的 apt 源）。然后：

```bash
cp /opt/ctdp/server/deploy/Caddyfile.example /etc/caddy/Caddyfile
nano /etc/caddy/Caddyfile        # 把 your-subdomain.example.org 换成你的子域名
systemctl reload caddy
journalctl -u caddy -n 30        # 看证书是否申请成功
```

从任意电脑检查：

```bash
curl https://your-subdomain.example.org/api/health   # {"ok":true}
curl -I https://your-subdomain.example.org/          # 200，content-type: text/html
```

## 7. 连接设备

**电脑端**：Settings → Sync，填：
- Server address：`https://your-subdomain.example.org`
- Token：`/etc/ctdp-sync.env` 里的 `CTDP_TOKEN`

第一台连接的设备会把自己的数据传到服务器。之后连接的设备如果已有不同的数据，会先询问，确认后改用服务器的数据，旧数据备份在本机数据文件旁边。

**手机端（iPhone，iOS 16.4 以上）**：
1. 用 **Safari** 打开 `https://your-subdomain.example.org/`。
2. 点分享按钮 → **添加到主屏幕**，以后从主屏幕的 CTDP 图标打开。**推送只在从主屏幕打开时可用**，在 Safari 标签页里不行。
3. 第一次打开时只需要输入令牌（地址就是当前网页）。手机会直接使用服务器上的数据。
4. 要收提醒：Settings → This device → **Turn on notifications**，允许通知，再点 **Send a test** 确认能收到。这个开关只管这部手机，电脑端的通知在电脑的 Settings 里单独开关。

服务器推送三种提醒：预约还剩 2 分钟、预约到期、落座到达最小时长。

手机端的数据存在 Safari 的网页存储里。打开过一次以后，没网也能打开和操作，联网后自动同步。iOS 可能清理长期不用的网页数据，这时重新输入令牌，数据会从服务器取回（还没同步上去的操作会丢失）。

## 日常维护

**更新：**

```bash
cd /opt/ctdp && git pull
cd server && npm ci && npm run build
cd .. && ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci && npm run build:web
systemctl restart ctdp-sync
```

**备份：** 所有数据（操作记录、推送订阅、推送密钥）都在 `/var/lib/ctdp-sync/ctdp.db`。

```bash
systemctl stop ctdp-sync
cp /var/lib/ctdp-sync/ctdp.db* /你的备份目录/
systemctl start ctdp-sync
```

（`ctdp.db-wal`、`ctdp.db-shm` 如果存在，要和 `ctdp.db` 一起拷。）

**换令牌：** 改 `/etc/ctdp-sync.env` 里的 `CTDP_TOKEN`，`systemctl restart ctdp-sync`，然后每台设备 Disconnect 再用新令牌 Connect。

**清空服务器重新开始：** 停服务，删掉 `/var/lib/ctdp-sync/ctdp.db*`，启动服务。各设备会显示同步失败，Disconnect 后重新 Connect；第一台连接的设备的数据会成为新的起点。

## 已有 nginx 的情况

不装 Caddy，在 nginx 里加一个 server 块，用 certbot 申请证书：

```nginx
server {
    server_name your-subdomain.example.org;
    client_max_body_size 10m;
    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    listen 80;
}
```

```bash
certbot --nginx -d your-subdomain.example.org
```

## 出问题时

| 现象 | 检查 |
|------|------|
| 电脑端 “Cannot reach the server” | `curl https://子域名/api/health`；DNS、443 端口、Caddy 日志 |
| “Wrong token” | 设备上输入的令牌和 `/etc/ctdp-sync.env` 是否一致（注意首尾空格） |
| “The server has no data any more” | 服务器被清空过：Disconnect 后重新 Connect |
| 手机打开是 `{"error":"not found"}` | 网页程序没构建：在 `/opt/ctdp` 执行 `npm run build:web`，或检查 `STATIC_DIR` |
| 手机上没有 “Turn on notifications” 按钮，提示要先添加到主屏幕 | 从主屏幕图标打开，不要在 Safari 里打开；iOS 需要 16.4 以上 |
| 打开了通知但收不到 | 先点 Send a test；查 `journalctl -u ctdp-sync` 里有没有 `push to ... failed`；`VAPID_SUBJECT` 不能是默认值 |
| 手机上的页面没更新 | 有网时打开总会取最新版本；从后台划掉 CTDP 再打开一次 |
| 服务起不来 | `journalctl -u ctdp-sync -n 50`；Node 版本是否 ≥ 22.13；`CTDP_TOKEN` 是否至少 16 个字符 |
