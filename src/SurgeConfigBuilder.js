import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { SURGE_CONFIG, SURGE_SITE_RULE_SET_BASEURL, SURGE_IP_RULE_SET_BASEURL, generateRules, getOutbounds, PREDEFINED_RULE_SETS } from './config.js';
import { t } from './i18n/index.js';

export class SurgeConfigBuilder extends BaseConfigBuilder {
    constructor(inputString, selectedRules, customRules, baseConfig, lang, userAgent) {
        // Not yet implemented, set aside for later use ;)
        // if (!baseConfig) {
        //     baseConfig = SURGE_CONFIG;
        // }
        baseConfig = SURGE_CONFIG;
        super(inputString, baseConfig, lang, userAgent);
        this.selectedRules = selectedRules;
        this.customRules = customRules;
        this.subscriptionUrl = null;
    }

    setSubscriptionUrl(url) {
        this.subscriptionUrl = url;
        return this;
    }

    getProxies() {
        return this.config.proxies || [];
    }

    getHy2Proxies() {
        return this.getProxies().filter(proxy => proxy.type === 'hysteria2');
    }

    getProxyName(proxy) {
        return proxy.split('=')[0].trim();
    }

    convertProxy(proxy) {
        let surgeProxy;
        switch (proxy.type) {
            case 'shadowsocks':
                surgeProxy = `${proxy.tag} = ss, ${proxy.server}, ${proxy.server_port}, encrypt-method=${proxy.method}, password=${proxy.password}`;
                break;
            case 'vmess':
                surgeProxy = `${proxy.tag} = vmess, ${proxy.server}, ${proxy.server_port}, username=${proxy.uuid}`;
                if (proxy.alter_id == 0) {
                    surgeProxy += ', vmess-aead=true';
                }
                if (proxy.tls?.enabled) {
                    surgeProxy += ', tls=true';
                    if (proxy.tls.server_name) {
                        surgeProxy += `, sni=${proxy.tls.server_name}`;
                    }
                    if (proxy.tls.insecure) {
                        surgeProxy += ', skip-cert-verify=true';
                    }
                    if (proxy.tls.alpn) {
                        surgeProxy += `, alpn=${proxy.tls.alpn.join(',')}`;
                    }
                }
                if (proxy.transport?.type === 'ws') {
                    surgeProxy += `, ws=true, ws-path=${proxy.transport.path}`;
                    if (proxy.transport.headers) {
                        surgeProxy += `, ws-headers=Host:${proxy.transport.headers.Host}`;
                    }
                } else if (proxy.transport?.type === 'grpc') {
                    surgeProxy += `, grpc-service-name=${proxy.transport.service_name}`;
                }
                break;
            case 'trojan':
                surgeProxy = `${proxy.tag} = trojan, ${proxy.server}, ${proxy.server_port}, password=${proxy.password}`;
                if (proxy.tls?.server_name) {
                    surgeProxy += `, sni=${proxy.tls.server_name}`;
                }
                if (proxy.tls?.insecure) {
                    surgeProxy += ', skip-cert-verify=true';
                }
                if (proxy.tls?.alpn) {
                    surgeProxy += `, alpn=${proxy.tls.alpn.join(',')}`;
                }
                if (proxy.transport?.type === 'ws') {
                    surgeProxy += `, ws=true, ws-path=${proxy.transport.path}`;
                    if (proxy.transport.headers) {
                        surgeProxy += `, ws-headers=Host:${proxy.transport.headers.Host}`;
                    }
                } else if (proxy.transport?.type === 'grpc') {
                    surgeProxy += `, grpc-service-name=${proxy.transport.service_name}`;
                }
                break;
            case 'hysteria2':
                surgeProxy = `${proxy.tag} = hysteria2, ${proxy.server}, ${proxy.server_port}, password=${proxy.password}`;
                if (proxy.tls?.server_name) {
                    surgeProxy += `, sni=${proxy.tls.server_name}`;
                }
                if (proxy.tls?.insecure) {
                    surgeProxy += ', skip-cert-verify=true';
                }
                if (proxy.tls?.alpn) {
                    surgeProxy += `, alpn=${proxy.tls.alpn.join(',')}`;
                }
                break;
            case 'tuic':
                // 处理tuic的uuid和password
                let tuicUuid = proxy.uuid;
                let tuicPassword = proxy.password;
                
                // 检查uuid字段是否包含冒号(格式如: "uuid:password")
                if (proxy.uuid && proxy.uuid.includes(':')) {
                    const parts = proxy.uuid.split(':');
                    tuicUuid = parts[0]; // 取冒号前面的uuid
                    
                    // 如果password为undefined且uuid字段包含冒号，使用冒号后面的部分作为password
                    if (proxy.password === 'undefined' || proxy.password === undefined) {
                        tuicPassword = parts[1];
                    }
                }
                
                surgeProxy = `${proxy.tag} = tuic, ${proxy.server}, ${proxy.server_port}, password=${tuicPassword === 'undefined' ? '' : tuicPassword}, uuid=${tuicUuid}`;
                if (proxy.tls?.server_name) {
                    surgeProxy += `, sni=${proxy.tls.server_name}`;
                }
                if (proxy.tls?.alpn) {
                    surgeProxy += `, alpn=${proxy.tls.alpn.join(',')}`;
                }
                if (proxy.tls?.insecure) {
                    surgeProxy += ', skip-cert-verify=true';
                }
                if (proxy.congestion_control) {
                    surgeProxy += `, congestion-controller=${proxy.congestion_control}`;
                }
                if (proxy.udp_relay_mode) {
                    surgeProxy += `, udp-relay-mode=${proxy.udp_relay_mode}`;
                }
                break;
            default:
                surgeProxy = `# ${proxy.tag} - Unsupported proxy type: ${proxy.type}`;
        }
        return surgeProxy;
    }

    addProxyToConfig(proxy) {
        this.config.proxies = this.config.proxies || [];
        this.config.proxies.push(proxy);
    }

    createProxyGroup(name, type, options = [], extraConfig = '') {
        const baseOptions = type === 'url-test' ? [] : ['DIRECT', 'REJECT-DROP'];
        const proxyNames = this.getProxies().map(proxy => this.getProxyName(proxy));
        const allOptions = [...baseOptions, ...options, ...proxyNames];
        return `${name} = ${type}, ${allOptions.join(', ')}${extraConfig}`;
    }

    addAutoSelectGroup(proxyList) {
        this.config['proxy-groups'] = this.config['proxy-groups'] || [];
        this.config['proxy-groups'].push(
            this.createProxyGroup(t('outboundNames.Auto Select'), 'url-test', [], ', url=http://www.gstatic.com/generate_204, interval=300')
        );
    }

    addHysteriaAutoSelectGroup(proxyList) {
        // 使用 getHy2Proxies 获取 hysteria2 类型的节点
        const hysteriaProxies = this.getHy2Proxies();
        console.log(hysteriaProxies);

        if (hysteriaProxies.length > 0) {
            this.config['proxy-groups'] = this.config['proxy-groups'] || [];
            this.config['proxy-groups'].push(
                this.createProxyGroup(
                    t('outboundNames.Hysteria'),
                    'select',
                    hysteriaProxies.map(proxy => proxy.tag),
                    ', url=http://www.gstatic.com/generate_204, interval=300'
                )
            );
        }
    }

    addNodeSelectGroup(proxyList) {
        // 获取 Hysteria 节点
        const hysteriaProxies = this.getHy2Proxies();

        // 根据是否有 Hysteria 节点来决定添加的选项
        const additionalOptions = hysteriaProxies.length > 0 ? [t('outboundNames.Auto Select'), t('outboundNames.Hysteria')] : [t('outboundNames.Auto Select')];

        this.config['proxy-groups'].push(
            this.createProxyGroup(t('outboundNames.Node Select'), 'select', additionalOptions)
        );
    }

    addOutboundGroups(outbounds, proxyList) {
        outbounds.forEach(outbound => {
            if (outbound !== t('outboundNames.Node Select')) {
                this.config['proxy-groups'].push(
                    this.createProxyGroup(t(`outboundNames.${outbound}`), 'select', [t('outboundNames.Node Select')])
                );
            }
        });
    }

    addCustomRuleGroups(proxyList) {
        if (Array.isArray(this.customRules)) {
            this.customRules.forEach(rule => {
                this.config['proxy-groups'].push(
                    this.createProxyGroup(rule.name, 'select', [t('outboundNames.Node Select')])
                );
            });
        }
    }

    addFallBackGroup(proxyList) {
        this.config['proxy-groups'].push(
            this.createProxyGroup(t('outboundNames.Fall Back'), 'select', [t('outboundNames.Node Select')])
        );
    }

    formatConfig() {
        const rules = generateRules(this.selectedRules, this.customRules);
        let finalConfig = [];

        if (this.subscriptionUrl) {
            finalConfig.push(`#!MANAGED-CONFIG ${this.subscriptionUrl} interval=43200 strict=false`);
            finalConfig.push('');  // 添加一个空行
        }

        finalConfig.push('[General]');
        if (this.config.general) {
            Object.entries(this.config.general).forEach(([key, value]) => {
                finalConfig.push(`${key} = ${value}`);
            });
        }

        if (this.config.replica) {
            finalConfig.push('\n[Replica]');
            Object.entries(this.config.replica).forEach(([key, value]) => {
                finalConfig.push(`${key} = ${value}`);
            });
        }

        finalConfig.push('\n[Proxy]');
        finalConfig.push('DIRECT = direct');
        if (this.config.proxies) {
            finalConfig.push(...this.config.proxies);
        }

        finalConfig.push('\n[Proxy Group]');
        if (this.config['proxy-groups']) {
            finalConfig.push(...this.config['proxy-groups']);
        }

        finalConfig.push('\n[Rule]');
        rules.forEach(rule => {
            if (rule.site_rules[0] !== '') {
                rule.site_rules.forEach(site => {
                    finalConfig.push(`RULE-SET,${SURGE_SITE_RULE_SET_BASEURL}${site}.conf,${t('outboundNames.'+ rule.outbound)}`);
                });
            }

            if (rule.ip_rules[0] !== '') {
                rule.ip_rules.forEach(ip => {
                    finalConfig.push(`RULE-SET,${SURGE_IP_RULE_SET_BASEURL}${ip}.txt,${t('outboundNames.'+ rule.outbound)},no-resolve`);
                });
            }

            if (rule.domain_suffix) {
                rule.domain_suffix.forEach(suffix => {
                    finalConfig.push(`DOMAIN-SUFFIX,${suffix},${t('outboundNames.' + rule.outbound)}`);
                });
            }

            if (rule.domain_keyword) {
                rule.domain_keyword.forEach(keyword => {
                    finalConfig.push(`DOMAIN-KEYWORD,${keyword},${t('outboundNames.' + rule.outbound)}`);
                });
            }

            if (rule.ip_cidr) {
                rule.ip_cidr.forEach(cidr => {
                    finalConfig.push(`IP-CIDR,${cidr},${t('outboundNames.' + rule.outbound)},no-resolve`);
                });
            }
        });

        finalConfig.push('FINAL,' + t('outboundNames.Fall Back'));

        return finalConfig.join('\n');
    }

    getCurrentUrl() {
        try {
            if (typeof self !== 'undefined' && self.location) {
                return self.location.href;
            }
            return null;
        } catch (error) {
            console.error('Error getting current URL:', error);
            return null;
        }
    }
}
