<div align="center">
  <h1><b>Sublink Worker</b></h1>
  <h5><i>Serverless 自部署订阅转换工具最佳实践</i></h5>

  <a href="https://trendshift.io/repositories/12291" target="_blank">
    <img src="https://trendshift.io/api/badge/repositories/12291" alt="7Sageer%2Fsublink-worker | Trendshift" width="250" height="55"/>
  </a>

  <!-- <p>
    <a href="https://sublink-worker.sageer.me">https://sublink-worker.sageer.me</a>
  </p> -->
  <br>

  <p>
    <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/7Sageer/sublink-worker">
      <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare Workers"/>
    </a>
  </p>
</div>

## 🚀 快速开始

### 一键部署
点击上方的 "Deploy to Cloudflare" 按钮，即可快速部署您的专属订阅转换服务。

### 新手指南
- [视频教程1](https://www.youtube.com/watch?v=ZTgDm4qReyA)
- [视频教程2](https://www.youtube.com/watch?v=_1BfM2Chn7w)
- [视频教程3](https://www.youtube.com/watch?v=7abmWqCXPR8)

> 💡 这些是由Youtube社区成员制作的教程视频，详细的讲解可以让你快速上手。但是部分内容可能与我们的见解不同，也可能与最新版本存在差异，建议同时参考[官方文档](/docs)

## ✨ 功能特点

### 支持协议
- ShadowSocks
- VMess
- VLESS
- Hysteria2
- Trojan
- TUIC

### 核心功能
- 支持导入 Base64 的 http/https 订阅链接以及多种协议的分享URL
- 纯JavaScript + Cloudflare Worker实现，一键部署，开箱即用
- 支持固定/随机短链接生成（基于 KV）
- 浅色/深色主题切换
- 灵活的 API，支持脚本化操作
- 中文，英语，波斯语三语言支持

### 客户端支持
- Sing-Box
- Clash
- Xray/V2Ray

### Web 界面特性
- 用户友好的操作界面
- 提供多种预定义规则集
- 可自建关于 geo-site、geo-ip、ip-cidr 和 domain-suffix 的自定义策略组

## 📖 API 文档

详细的 API 文档请参考 [API-doc.md](/docs/API-doc.md)

### 主要端点
- `/singbox` - 生成 Sing-Box 配置，参考[SingBox配置文档](https://sing-box.sagernet.org/zh/configuration/)
- `/clash` - 生成 Clash 配置，参考[mihomo配置文档](https://wiki.metacubex.one/config/)
- `/xray` - 生成 Xray 配置
- `/shorten` - 生成短链接

## 📝 最近更新

### 2025-03-08

- 支持自定义UA
- 全面使用Clash Meta的Rule Provider

## 🔧 项目结构

```
.
├── index.js                 # 主要的服务器逻辑，处理请求路由
├── BaseConfigBuilder.js     # 构建基础配置
├── SingboxConfigBuilder.js  # 构建 Sing-Box 配置
├── ClashConfigBuilder.js    # 构建 Clash 配置
├── ProxyParsers.js         # 解析各种代理协议的 URL
├── utils.js                # 提供各种实用函数
├── htmlBuilder.js          # 生成 Web 界面
├── style.js               # 生成 Web 界面的 CSS
├── config.js              # 保存配置信息
└── docs/
    ├── API-doc.md         # API 文档
    ├── update-log.md      # 更新日志
    └── FAQ.md             # 常见问题解答
```

## 📒 添加[sing-box](https://github.com/SagerNet/sing-box)为子模块

添加[sing-box](https://github.com/SagerNet/sing-box)为子模块，目的是让SingBox的基础配置文件能够和官方[migration.md](https://github.com/SagerNet/sing-box/blob/stable/docs/migration.md)保持一致：

```bash
git submodule add -b main https://github.com/SagerNet/sing-box.git sing-box
cd sing-box
git submodule update --init --recursive

# 查看最新Release版本号, 为 v1.11.7 (需要和你安装的SingBox版本一致)
# 但是在官方Release版本, 在我的Win11上运行出错, 所以我最终是签出的v1.11.6版本
git describe --tags $(git rev-list --tags=$(git tag | grep -vE 'beta|alpha|rc') --max-count=1)
# git checkout v1.11.7
git checkout v1.11.6
git switch -c latest

# 一条命令搞定
git fetch --tags && git checkout $(git describe --tags $(git rev-list --tags=$(git tag | grep -vE 'beta|alpha|rc') --max-count=1)) && git switch -c latest
```

如果想移除刚刚添加的子模块，直接删除`sing-box`目录是不对的，正确做法：

```bash
git submodule deinit -f sing-box
git rm -f sing-box
rm -rf .git/modules/sing-box
```

在Win11上编译`sing-box`：

```powershell
# 设置 GOTOOLCHAIN 环境变量
$env:GOTOOLCHAIN = "local"

# 获取版本信息
$version = go run ./cmd/internal/read_tag

# 编译命令
go build -v -trimpath -ldflags "-X 'github.com/sagernet/sing-box/constant.Version=$version' -s -w -buildid=" `
-tags "with_gvisor,with_dhcp,with_wireguard,with_reality_server,with_clash_api,with_quic,with_utls,with_tailscale" `
-o sing-box.exe ./cmd/sing-box
```

## 🛜TUN模式下内网域名的解析

实验室采用Docker的方式部署了一个[SmartDNS](https://hub.docker.com/r/pymumu/smartdns)容器用于内网域名的解析，`smartdns.conf`文件内容：

```ini
# 监听53端口
bind [::]:53

# 局域网域名和IP映射
address /ss.p7760.lan/192.168.3.200
address /comfyui.p7760.lan/192.168.3.200

address /ss.eda5k.lan/192.168.3.55
address /sb.eda5k.lan/192.168.3.112
address /fnos.eda5k.lan/192.168.3.112
address /sync.eda5k.lan/192.168.3.112

address /ss.eda007.lan/192.168.3.36
address /sb.eda007.lan/192.168.3.113
address /fnos.eda007.lan/192.168.3.113

address /github.cigit.lan/192.168.3.112
address /ca.cigit.lan/192.168.3.112
address /traefik.cigit.lan/192.168.3.112
address /ollama.cigit.lan/192.168.3.117

# 上游DNS服务器
server 8.8.8.8
server 1.0.0.1
server 1.2.4.8
```

如果采用默认配置，那么TUN模式下是无法访问内网域名的，用`tcpdump`观察流量发现是SingBox的TUN模式导致了错误解析。甚至不能叫错误解析，因为即使我设置了SmartDNS为主要DNS，在TUN模式下流量都被SingBox接管了，只要[DNS解析规则](https://github.com/SagerNet/sing-box/blob/v1.11.7/docs/configuration/dns/rule.zh.md)里面没有内网域名的解析方法，它都无法成功解析到。

```bash
# Tmux下开2个窗口分别执行下面的命令查看
sudo tcpdump -i any port 53 and host 192.168.3.53
nslookup github.cigit.lan
```

解决方案–自定义SingBox配置：

```json
{
  "dns": {
    "servers": [
      {
        "tag": "dns_proxy",
        "address": "tcp://1.1.1.1",
        "address_resolver": "dns_resolver",
        "strategy": "ipv4_only",
        "detour": "✅ 节点选择"
      },
      {
        "tag": "dns_direct",
        "address": "https://dns.alidns.com/dns-query",
        "address_resolver": "dns_resolver",
        "strategy": "ipv4_only",
        "detour": "DIRECT"
      },
      {
        "tag": "dns_local",
        "address": "192.168.3.53",
        "detour": "DIRECT"
      },
      {
        "tag": "dns_resolver",
        "address": "223.5.5.5",
        "detour": "DIRECT"
      },
      {
        "tag": "dns_success",
        "address": "rcode://success"
      },
      {
        "tag": "dns_refused",
        "address": "rcode://refused"
      },
      {
        "tag": "dns_fakeip",
        "address": "fakeip"
      }
    ],
    "rules": [
      {
        "outbound": "any",
        "server": "dns_resolver"
      },
      {
        "domain_suffix": [
          ".internal",
          ".local",
          ".lan"
        ],
        "server": "dns_local"
      },
      {
        "rule_set": "geolocation-!cn",
        "query_type": [
          "A",
          "AAAA"
        ],
        "server": "dns_fakeip"
      },
      {
        "rule_set": "geolocation-!cn",
        "query_type": [
          "CNAME"
        ],
        "server": "dns_proxy"
      },
      {
        "query_type": [
          "A",
          "AAAA",
          "CNAME"
        ],
        "invert": true,
        "server": "dns_refused",
        "disable_cache": true
      }
    ],
    "final": "dns_direct",
    "independent_cache": true,
    "fakeip": {
      "enabled": true,
      "inet4_range": "198.18.0.0/15",
      "inet6_range": "fc00::/18"
    }
  },
  "ntp": {
    "enabled": true,
    "server": "time.apple.com",
    "server_port": 123,
    "interval": "30m",
    "detour": "DIRECT"
  },
  "inbounds": [
    {
      "type": "mixed",
      "tag": "mixed-in",
      "listen": "0.0.0.0",
      "listen_port": 10808
    },
    {
      "type": "tun",
      "tag": "tun-in",
      "address": [
        "172.10.0.1/30",
        "fdfe:dcba:9876::1/126"
      ],
      "route_address": [
        "0.0.0.0/1",
        "128.0.0.0/1",
        "::/1",
        "8000::/1"
      ],
      "route_exclude_address": [
        "192.168.0.0/16",
        "fc00::/7"
      ]
    }
  ],
  "outbounds": [
    {
      "type": "direct",
      "tag": "DIRECT"
    },
    {
      "type": "block",
      "tag": "REJECT"
    },
    {
      "type": "dns",
      "tag": "dns-out"
    }
  ],
  "route": {},
  "experimental": {
    "cache_file": {
      "enabled": true,
      "store_fakeip": true
    },
    "clash_api": {
      "external_controller": "0.0.0.0:9090",
      "external_ui": "yacd",
      "secret": "herowuking.singbox",
      "default_mode": "rule"
    }
  }
}
```

在DNS服务器列表里面新增了局域网SmartDNS：

```json
"dns": {
    "servers": [
			// ...
      // 新增的 dns_local 就是局域网SmartDNS的地址
      {
        "tag": "dns_local",
        "address": "192.168.3.53",
        "detour": "DIRECT"
      },
			// ...
```

另外，在DNS规则里面增加一个根据域名后缀判断的解析分流规则：

```json
"dns": {
  	 // ...
    "rules": [      
      // ...
      // 新增的DNS解析分流规则
      {
        "domain_suffix": [
          ".internal",
          ".local",
          ".lan"
        ],
        "server": "dns_local"
      },
			// ...
```

至此，问题完美解决了💯

## 🤝 贡献

欢迎提交 Issues 和 Pull Requests 来改进这个项目。

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## ⚠️ 免责声明

本项目仅供学习交流使用，请勿用于非法用途。使用本项目所造成的一切后果由使用者自行承担，与开发者无关。

## ⭐ Star History

感谢所有为本项目点亮 Star 的朋友们！🌟

<a href="https://star-history.com/#7Sageer/sublink-worker&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=7Sageer/sublink-worker&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=7Sageer/sublink-worker&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=7Sageer/sublink-worker&type=Date" />
 </picture>
</a>



