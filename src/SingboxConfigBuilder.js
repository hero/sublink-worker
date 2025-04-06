import { SING_BOX_CONFIG, generateRuleSets, generateRules, getOutbounds, PREDEFINED_RULE_SETS} from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy } from './utils.js';
import { t } from './i18n/index.js';

export class SingboxConfigBuilder extends BaseConfigBuilder {
    constructor(inputString, selectedRules, customRules, baseConfig, lang, userAgent) {
        if (baseConfig === undefined) {
            baseConfig = SING_BOX_CONFIG;
            if (baseConfig.dns && baseConfig.dns.servers) {
                baseConfig.dns.servers[0].detour = t('outboundNames.Node Select');
            }
        }
        super(inputString, baseConfig, lang, userAgent);
        this.selectedRules = selectedRules;
        this.customRules = customRules;
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
        return proxy;
    }

    addProxyToConfig(proxy) {
        this.config.outbounds.push(proxy);
    }

    addAutoSelectGroup(proxyList) {
        this.config.outbounds.unshift({
            type: "urltest",
            tag: t('outboundNames.Auto Select'),
            outbounds: DeepCopy(proxyList),
        });
    }

    // 新增 Hysteria 自动过滤测速组
    addHysteriaAutoSelectGroup(proxyList) {
        // 使用 getHy2Proxies 获取 hysteria2 类型的节点
        const hysteriaProxies = this.getHy2Proxies();
        
        // 只有当存在 hysteria2 节点时才添加分组
        if (hysteriaProxies.length > 0) {
            this.config.outbounds.unshift({
                type: "urltest",
                tag: t('outboundNames.Hysteria'),
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
            type: "selector",
            tag: t('outboundNames.Node Select'),
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
                    type,
                    tag: t(outboundName),
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
                    type: "selector",
                    tag: rule.name,
                    outbounds: [t('outboundNames.Node Select'), ...proxyList]
                });
            });
        }
    }

    addFallBackGroup(proxyList) {
        // 漏网之鱼走`自动选择`
        this.config.outbounds.push({
            type: "urltest",
            tag: t('outboundNames.Fall Back'),
            outbounds: [t('outboundNames.Node Select'), ...proxyList]
        });
    }

    formatConfig() {
        const rules = generateRules(this.selectedRules, this.customRules);
        const { site_rule_sets, ip_rule_sets } = generateRuleSets(this.selectedRules,this.customRules);

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

        return this.config;
    }
}