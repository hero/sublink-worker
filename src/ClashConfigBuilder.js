import yaml from 'js-yaml';
import { CLASH_CONFIG, generateRules, generateClashRuleSets, getOutbounds, PREDEFINED_RULE_SETS } from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy } from './utils.js';
import { t } from './i18n/index.js';

export class ClashConfigBuilder extends BaseConfigBuilder {
    constructor(inputString, selectedRules, customRules, baseConfig, lang, userAgent, options = {}) {
        if (!baseConfig) {
            baseConfig = CLASH_CONFIG;
        }
        super(inputString, baseConfig, lang, userAgent);
        this.selectedRules = selectedRules;
        this.customRules = customRules;
        this.options = {
            enableFakeIP: options.enableFakeIP || false,
            enableTun: options.enableTun !== false, // 默认为true
            customSecret: options.customSecret || 'herowuking.singbox',
            listenPort: options.listenPort || '10808'
        };
    }

    getProxies() {
        return this.config.proxies || [];
    }

    getHy2Proxies() {
        return this.getProxies().filter(proxy => proxy.type === 'hysteria2');
    }

    getProxyName(proxy) {
        return proxy.name;
    }

    convertProxy(proxy) {
        switch (proxy.type) {
            case 'shadowsocks':
                return {
                    name: proxy.tag,
                    type: 'ss',
                    server: proxy.server,
                    port: proxy.server_port,
                    cipher: proxy.method,
                    password: proxy.password
                };
            case 'vmess':
                return {
                    name: proxy.tag,
                    type: proxy.type,
                    server: proxy.server,
                    port: proxy.server_port,
                    uuid: proxy.uuid,
                    alterId: proxy.alter_id,
                    cipher: proxy.security,
                    tls: proxy.tls?.enabled || false,
                    servername: proxy.tls?.server_name || '',
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws' ? {
                        path: proxy.transport.path,
                        headers: proxy.transport.headers
                    } : undefined
                };
            case 'vless':
                return {
                    name: proxy.tag,
                    type: proxy.type,
                    server: proxy.server,
                    port: proxy.server_port,
                    uuid: proxy.uuid,
                    cipher: proxy.security,
                    tls: proxy.tls?.enabled || false,
                    'client-fingerprint': proxy.tls.utls?.fingerprint,
                    servername: proxy.tls?.server_name || '',
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws' ? {
                        path: proxy.transport.path,
                        headers: proxy.transport.headers
                    } : undefined,
                    'reality-opts': proxy.tls.reality?.enabled ? {
                        'public-key': proxy.tls.reality.public_key,
                        'short-id': proxy.tls.reality.short_id,
                    } : undefined,
                    'grpc-opts': proxy.transport?.type === 'grpc' ? {
                        'grpc-service-name': proxy.transport.service_name,
                    } : undefined,
                    tfo: proxy.tcp_fast_open,
                    'skip-cert-verify': proxy.tls.insecure,
                    'flow': proxy.flow ?? undefined,
                };
            case 'hysteria2':
                return {
                    name: proxy.tag,
                    type: proxy.type,
                    server: proxy.server,
                    port: proxy.server_port,
                    obfs: proxy.obfs.type,
                    'obfs-password': proxy.obfs.password,
                    password: proxy.password,
                    auth: proxy.password,
                    'skip-cert-verify': proxy.tls.insecure,
                };
            case 'trojan':
                return {
                    name: proxy.tag,
                    type: proxy.type,
                    server: proxy.server,
                    port: proxy.server_port,
                    password: proxy.password,
                    cipher: proxy.security,
                    tls: proxy.tls?.enabled || false,
                    'client-fingerprint': proxy.tls.utls?.fingerprint,
                    sni: proxy.tls?.server_name || '',
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws' ? {
                        path: proxy.transport.path,
                        headers: proxy.transport.headers
                    } : undefined,
                    'reality-opts': proxy.tls.reality?.enabled ? {
                        'public-key': proxy.tls.reality.public_key,
                        'short-id': proxy.tls.reality.short_id,
                    } : undefined,
                    'grpc-opts': proxy.transport?.type === 'grpc' ? {
                        'grpc-service-name': proxy.transport.service_name,
                    } : undefined,
                    tfo: proxy.tcp_fast_open,
                    'skip-cert-verify': proxy.tls.insecure,
                    'flow': proxy.flow ?? undefined,
                };
            case 'tuic':
                return {
                    name: proxy.tag,
                    type: proxy.type,
                    server: proxy.server,
                    port: proxy.server_port,
                    uuid: proxy.uuid,
                    password: proxy.password,
                    'congestion-controller': proxy.congestion,
                    'skip-cert-verify': proxy.tls.insecure,
                    'disable-sni': true,
                    'alpn': proxy.tls.alpn,
                    'sni': proxy.tls.server_name,
                    'udp-relay-mode': 'native',
                };
            default:
                return proxy; // Return as-is if no specific conversion is defined
        }
    }

    addProxyToConfig(proxy) {
        this.config.proxies = this.config.proxies || [];
        this.config.proxies.push(proxy);
    }

    addAutoSelectGroup(proxyList) {
        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        this.config['proxy-groups'].push({
            name: t('outboundNames.Auto Select'),
            type: 'url-test',
            proxies: DeepCopy(proxyList),
            url: 'https://www.gstatic.com/generate_204',
            interval: 300,
            lazy: false
        });
    }

    addHysteriaAutoSelectGroup(proxyList) {
        // 使用 getHy2Proxies 获取 hysteria2 类型的节点
        const hysteriaProxies = this.getHy2Proxies();

        // 只有当存在 hysteria2 节点时才添加分组
        if (hysteriaProxies.length > 0) {
            this.config['proxy-groups'] = this.config['proxy-groups'] || [];
            this.config['proxy-groups'].push({
                name: t('outboundNames.Hysteria'),
                type: 'select',
                proxies: hysteriaProxies.map(proxy => proxy.name),
                url: 'https://www.gstatic.com/generate_204',
                interval: 300,
                lazy: false
            });
        }
    }

    addNodeSelectGroup(proxyList) {
        // 获取 hysteria2 节点，判断是否需要添加 Hysteria 组
        const hysteriaProxies = this.getHy2Proxies();
        const defaultOutbounds = ['DIRECT', 'REJECT', t('outboundNames.Auto Select')];

        // 只有存在 hysteria2 节点时才添加 Hysteria 组
        if (hysteriaProxies.length > 0) {
            defaultOutbounds.push(t('outboundNames.Hysteria'));
        }

        proxyList.unshift(...defaultOutbounds);

        // 添加其它节点列表
        this.config['proxy-groups'].unshift({
            name: t('outboundNames.Node Select'),
            type: "select",
            proxies: proxyList
        });
    }

    addOutboundGroups(outbounds, proxyList) {
        outbounds.forEach(outbound => {
            if (outbound !== t('outboundNames.Node Select')) {
                this.config['proxy-groups'].push({
                    name: t(`outboundNames.${outbound}`),
                    type: "select",
                    proxies: [t('outboundNames.Node Select'), ...proxyList]
                });
            }
        });
    }

    addCustomRuleGroups(proxyList) {
        if (Array.isArray(this.customRules)) {
            this.customRules.forEach(rule => {
                this.config['proxy-groups'].push({
                    name: t(`outboundNames.${rule.name}`),
                    type: "select",
                    proxies: [t('outboundNames.Node Select'), ...proxyList]
                });
            });
        }
    }

    addFallBackGroup(proxyList) {
        this.config['proxy-groups'].push({
            name: t('outboundNames.Fall Back'),
            type: "select",
            proxies: [t('outboundNames.Node Select'), ...proxyList]
        });
    }

    // 生成规则
    generateRules() {
        return generateRules(this.selectedRules, this.customRules);
    }

    formatConfig() {
        const rules = this.generateRules();

        // 获取.mrs规则集配置
        const { site_rule_providers, ip_rule_providers } = generateClashRuleSets(this.selectedRules, this.customRules);

        // 添加规则集提供者
        this.config['rule-providers'] = {
            ...site_rule_providers,
            ...ip_rule_providers
        };

        // 使用RULE-SET规则格式替代原有的GEOSITE/GEOIP
        this.config.rules = rules.flatMap(rule => {
            const ruleResults = [];

            // 使用RULE-SET格式的站点规则
            if (rule.site_rules && rule.site_rules[0] !== '') {
                rule.site_rules.forEach(site => {
                    ruleResults.push(`RULE-SET,${site},${t('outboundNames.' + rule.outbound)}`);
                });
            }

            // 使用RULE-SET格式的IP规则
            if (rule.ip_rules && rule.ip_rules[0] !== '') {
                rule.ip_rules.forEach(ip => {
                    ruleResults.push(`RULE-SET,${ip},${t('outboundNames.' + rule.outbound)},no-resolve`);
                });
            }

            // 保持对其他类型规则的支持
            const domainSuffixRules = rule.domain_suffix ? rule.domain_suffix.map(suffix =>
                `DOMAIN-SUFFIX,${suffix},${t('outboundNames.' + rule.outbound)}`) : [];
            const domainKeywordRules = rule.domain_keyword ? rule.domain_keyword.map(keyword =>
                `DOMAIN-KEYWORD,${keyword},${t('outboundNames.' + rule.outbound)}`) : [];
            const ipCidrRules = rule.ip_cidr ? rule.ip_cidr.map(cidr =>
                `IP-CIDR,${cidr},${t('outboundNames.' + rule.outbound)},no-resolve`) : [];

            return [...ruleResults, ...domainSuffixRules, ...domainKeywordRules, ...ipCidrRules];
        });

        this.config.rules.push(`MATCH,${t('outboundNames.Fall Back')}`);

        // 处理FakeIP选项
        if (this.config.dns) {
            // 设置fakeip配置
            this.config.dns.fakeip = {
                enabled: this.options.enableFakeIP,
                inet4_range: "198.18.0.0/15"
            };
            
            // 删除原有的enhanced-mode并添加正确格式的enhanced-mode
            delete this.config.dns['enhanced-mode']; // 删除原有的带横杠的格式
            
            // 根据FakeIP开启状态设置enhanced-mode
            this.config.dns.enhanced_mode = this.options.enableFakeIP ? 'fake-ip' : 'redir-host';
            
            if (this.config.experimental?.cache_file) {
                this.config.experimental.cache_file.store_fakeip = this.options.enableFakeIP;
            }
            
            // 如果禁用了FakeIP，移除dns_fakeip相关服务器和规则
            if (!this.options.enableFakeIP) {
                if (this.config.dns.servers) {
                    this.config.dns.servers = this.config.dns.servers.filter(server => 
                        server.tag !== 'dns_fakeip' && server.address !== 'fakeip');
                }
                
                if (this.config.dns.rules) {
                    this.config.dns.rules = this.config.dns.rules.filter(rule => 
                        rule.server !== 'dns_fakeip');
                }
            }
        }

        // 处理Tun模式选项
        if (!this.options.enableTun) {
            if (this.config.inbounds && Array.isArray(this.config.inbounds)) {
                this.config.inbounds = this.config.inbounds.filter(inbound => inbound.type !== 'tun');
            }
        }

        // 处理自定义secret
        if (this.options.customSecret) {
            if (!this.config.experimental) {
                this.config.experimental = {};
            }
            if (!this.config.experimental.clash_api) {
                this.config.experimental.clash_api = {};
            }
            this.config.experimental.clash_api.secret = this.options.customSecret;
        }

        // 处理监听端口
        if (this.options.listenPort) {
            // 修改所有非tun入站的端口
            if (this.config.inbounds && Array.isArray(this.config.inbounds)) {
                this.config.inbounds.forEach(inbound => {
                    if (inbound.type !== 'tun') {
                        inbound.listen_port = parseInt(this.options.listenPort);
                    }
                });
            }
        }

        return yaml.dump(this.config);
    }
}
