import { SING_BOX_CONFIG, generateRuleSets, generateRules, getOutbounds, PREDEFINED_RULE_SETS } from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy } from './utils.js';
import { t } from './i18n/index.js';

export class SingboxConfigBuilder extends BaseConfigBuilder {
    constructor(inputString, selectedRules, customRules, baseConfig, lang, userAgent, options = {}) {
        if (baseConfig === undefined) {
            baseConfig = SING_BOX_CONFIG;
            if (baseConfig.dns && baseConfig.dns.servers) {
                baseConfig.dns.servers[0].detour = t('outboundNames.Node Select');
            }
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
        return this.config.outbounds.filter(outbound => outbound?.server != undefined);
    }

    getHy2Proxies() {
        return this.getProxies().filter(proxy => proxy.type === 'hysteria2');
    }

    getProxyName(proxy) {
        return proxy.tag;
    }

    convertProxy(proxy) {
        // 如果是tuic类型代理，处理uuid和password
        if (proxy.type === 'tuic' && proxy.uuid) {
            // 检查uuid字段是否包含冒号(格式如: "uuid:password")
            if (proxy.uuid.includes(':')) {
                const parts = proxy.uuid.split(':');
                const originalProxy = {...proxy}; // 复制原始代理对象
                
                // 修改uuid为冒号前面的部分
                originalProxy.uuid = parts[0];
                
                // 如果password为undefined且uuid字段包含冒号，使用冒号后面的部分作为password
                if (originalProxy.password === 'undefined' || originalProxy.password === undefined) {
                    originalProxy.password = parts[1];
                }
                
                return originalProxy;
            }
        }
        return proxy;
    }

    addProxyToConfig(proxy) {
        this.config.outbounds.push(proxy);
    }

    addAutoSelectGroup(proxyList) {
        this.config.outbounds.unshift({
            tag: t('outboundNames.Auto Select'),
            type: "urltest",
            outbounds: DeepCopy(proxyList),
        });
    }

    // 新增 Hysteria 自动过滤测速组
    // 需要注意的是: 如果设置为了urltest，则无法使用Web UI进行手工选择
    // Clash API 仅支持 selector 类型节点组的手工切换节点操作
    addHysteriaAutoSelectGroup(proxyList) {
        // 使用 getHy2Proxies 获取 hysteria2 类型的节点
        const hysteriaProxies = this.getHy2Proxies();

        // 只有当存在 hysteria2 节点时才添加分组
        if (hysteriaProxies.length > 0) {
            this.config.outbounds.unshift({
                tag: t('outboundNames.Hysteria'),
                type: "urltest",
                outbounds: hysteriaProxies.map(proxy => proxy.tag)
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
        this.config.outbounds.unshift({
            tag: t('outboundNames.Node Select'),
            type: "selector",
            outbounds: proxyList
        });
    }

    addOutboundGroups(outbounds, proxyList) {
        outbounds.forEach(outbound => {
            if (outbound !== t('outboundNames.Node Select')) {
                const outboundName = `outboundNames.${outbound}`;
                const type = outboundName.includes('Location') || outboundName.includes('Private') ? 'direct' : 'selector';
                // 如果类型是direct，添加了outbounds属性则SingBox会报错, Clash Verge测试则可以
                // 所以这里需要判断类型，如果是direct，则不添加outbounds属性
                const outboundConfig = {
                    tag: t(outboundName),
                    type,
                };
                // 如果类型不是direct，则添加outbounds属性
                if (type !== 'direct') {
                    outboundConfig.outbounds = [t('outboundNames.Node Select'), ...proxyList];
                }
                this.config.outbounds.push(outboundConfig);
            }
        });
    }

    addCustomRuleGroups(proxyList) {
        if (Array.isArray(this.customRules)) {
            this.customRules.forEach(rule => {
                this.config.outbounds.push({
                    tag: rule.name,
                    type: "selector",
                    outbounds: [t('outboundNames.Node Select'), ...proxyList]
                });
            });
        }
    }

    addFallBackGroup(proxyList) {
        this.config.outbounds.push({
            tag: t('outboundNames.Fall Back'),
            type: "selector",
            outbounds: [t('outboundNames.Node Select'), ...proxyList]
        });
    }

    formatConfig() {
        const rules = generateRules(this.selectedRules, this.customRules);
        const { site_rule_sets, ip_rule_sets } = generateRuleSets(this.selectedRules, this.customRules);

        this.config.route.rule_set = [...site_rule_sets, ...ip_rule_sets];

        this.config.route.rules = rules.map(rule => ({
            rule_set: [
                ...(rule.site_rules.length > 0 && rule.site_rules[0] !== '' ? rule.site_rules : []),
                ...(rule.ip_rules.filter(ip => ip.trim() !== '').map(ip => `${ip}-ip`))
            ],
            domain_suffix: rule.domain_suffix,
            domain_keyword: rule.domain_keyword,
            ip_cidr: rule.ip_cidr,
            protocol: rule.protocol,
            outbound: t(`outboundNames.${rule.outbound}`)
        }));

        this.config.route.rules.unshift(
            { protocol: 'dns', outbound: 'dns-out' },
            { clash_mode: 'direct', outbound: 'DIRECT' },
            { clash_mode: 'global', outbound: t('outboundNames.Node Select') }
        );

        this.config.route.auto_detect_interface = true;
        this.config.route.final = t('outboundNames.Fall Back');

        // 处理FakeIP选项
        if (this.config.dns) {
            this.config.dns.fakeip = {
                enabled: this.options.enableFakeIP,
                inet4_range: "198.18.0.0/15"
            };
            if (this.config.experimental?.cache_file) {
                this.config.experimental.cache_file.store_fakeip = this.options.enableFakeIP;
            }
            
            // 如果禁用了FakeIP，从DNS服务器列表中移除dns_fakeip服务器
            if (!this.options.enableFakeIP) {
                if (this.config.dns.servers && Array.isArray(this.config.dns.servers)) {
                    this.config.dns.servers = this.config.dns.servers.filter(server => server.tag !== 'dns_fakeip');
                }
                
                // 同时需要移除使用了dns_fakeip的规则
                if (this.config.dns.rules && Array.isArray(this.config.dns.rules)) {
                    this.config.dns.rules = this.config.dns.rules.filter(rule => rule.server !== 'dns_fakeip');
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
        if (this.options.customSecret && this.config.experimental?.clash_api) {
            this.config.experimental.clash_api.secret = this.options.customSecret;
        }

        // 处理监听端口
        if (this.options.listenPort && this.config.inbounds && Array.isArray(this.config.inbounds)) {
            // 修改所有非tun入站的端口
            this.config.inbounds.forEach(inbound => {
                if (inbound.type !== 'tun') {
                    inbound.listen_port = parseInt(this.options.listenPort);
                }
            });
        }

        return this.config;
    }
}
