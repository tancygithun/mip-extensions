/**
 * @file mip-custom/dom
 * @author pearl
 */
define(function (require) {

    /**
     * [util 引入工具类]
     * @type {Object}
     */
    var util = require('util');

    /**
     * [templates 模板库]
     * @type {Object}
     */
    var templates = require('templates');

    /**
     * [fixedElement 引入 fixed 元素类]
     * @type {Object}
     */
    var fixedElement = require('fixed-element');

    var log = require('mip-custom/log');
    var dataProcessor = require('mip-custom/data');
    var regexs = dataProcessor.regexs;

    var maxzIndex = 0;
    var excr = 44;

    /**
     * [getCss 获取样式]
     * 由于目前只需要取 height 和 paddig-bottom,
     * 所以对util.css结果进行处理, 返回整数
     *
     * @param  {DOM} elem     dom 节点
     * @param  {string} style 获取样式
     * @return {integer} res 返回的数值
     */
    function getCss(elem, style) {
        var res = parseInt(util.css(elem, style), 10);
        return res || 0;
    }

    /**
     * [moveToFixedLayer 需要悬浮的组件外层嵌套mip-fixed并移动到 fixed layer]
     *
     * @param  {DOM} element    mip-custom 节点
     * @param  {DOM} customNode 定制化组件节点
     * @param  {DOM} container  装载定制化组件节点的容器
     */
    function moveToFixedLayer(element, customNode, container) {
        var type = customNode.getAttribute('mip-fixed');
        var top = customNode.getAttribute('top') || null;
        var bot = customNode.getAttribute('bottom') || null;
        var fixedParent = document.createElement('mip-fixed');

        // 兼容 酷派手机 UC 浏览器
        if (util.platform.isIos()) {
            container.remove();
            excr = 10;
        }

        // 存在悬浮时, 设置距离 top/bottom 的距离
        if (customNode.hasAttribute('top') && top) {
            util.css(fixedParent, {top: top});
        }
        if (customNode.hasAttribute('bottom') && bot) {
            util.css(fixedParent, {bottom: bot});
        }
        fixedParent.setAttribute('type', type);
        fixedParent.appendChild(customNode);
        element.appendChild(fixedParent);

        // 初始化底部fixed元素一开始在页面外部, 动画滑入页面
        // 预先增加下移样式，当元素被插入页面后（setTimeout执行），动画执行。
        if (type === 'bottom') {
            fixedParent.classList.add('mip-custom-transit-from-bottom');
            setTimeout(function () {
                fixedParent.classList.add('mip-custom-transit-end');
            }, 0);
        }

        // 结果页打开, 移动到 fixed layer
        if (fixedElement._fixedLayer) {
            fixedElement.setFixedElement([fixedParent], true);
            // 为悬浮节点添加代理事件
            proxyLink(customNode, fixedElement._fixedLayer);
        }
    }

    /**
     * [renderStyleOrScript 渲染 style/script 函数]
     * 截取 style/script 并插入到 dom 中
     *
     * @param {string} str    返回的 tpl 字符串
     * @param {RegExp} reg    截取的正则表达式
     * @param {string} tag    定制化 MIP 标签名
     * @param {string} attr   style/script
     * @param {DOM} container style/script 节点的容器
     */
    function renderStyleOrScript(str, reg, tag, attr, container) {

        var node = container.querySelector(tag + '[' + attr + ']') || document.createElement(tag);
        node.setAttribute(attr, '');
        var substrs = str.match(reg);
        substrs && substrs.forEach(function (tmp) {
            var reg = new RegExp('<' + tag + '>([\\S\\s]*)</' + tag + '>', 'g');
            var substr = reg.exec(tmp);
            var innerhtml = substr && substr[1] ? substr[1] : '';

            if (node.innerHTML.indexOf(innerhtml) === -1) {
                node.innerHTML += innerhtml;
            }
        });

        container.appendChild(node);
    }

    /**
     * [createTemplateNode 创建定制化组件的 template 子节点]
     *
     * @param  {string}  html 定制化组件 dom 字符串
     * @param  {integer} id   template id
     * @return {DOM}     tpl  template 子节点
     */
    function createTemplateNode(html, id) {
        var tpl = document.createElement('template');

        tpl.setAttribute('type', 'mip-mustache');
        if (id) {
            tpl.id = id;
        }
        tpl.innerHTML = dataProcessor.subStr(html, regexs.innerHtml);

        return tpl;

    }

    /**
     * [createCustomNode 创建定制化组件节点]
     *
     * @param  {string} html      定制化组件 dom 字符串
     * @param  {string} customTag 定制化组件标签
     * @return {DOM}    node      定制化组件节点
     */
    function createCustomNode(html, customTag) {

        var node = document.createElement(customTag);
        var tagandAttrs = dataProcessor.subStr(html, regexs.tagandAttr).split(' ');

        for (var i = 0; i < tagandAttrs.length; i++) {
            var attrs = tagandAttrs[i].split('=');

            if (attrs[0] && attrs[1]) {
                node.setAttribute(attrs[0], attrs[1].replace(/"/ig, ''));
            }
        }

        node.appendChild(createTemplateNode(html));
        return node;
    }

    /**
     * [renderHtml 渲染html]
     *
     * @param  {DOM}     element   mip-custom 节点
     * @param  {string}  str       返回的 tpl 字符串
     * @param  {integer} len       模块中第几个组件
     * @param  {Object}  result    渲染mustache模板的数据
     * @param  {DOM}     container 装载定制化组件节点的容器
     * @return {string}  customTag 定制化组件标签
     */
    function renderHtml(element, str, len, result, container) {
        var html = str.replace(regexs.script, '').replace(regexs.style, '');
        var customTag = (new RegExp(regexs.tag, 'g')).exec(html);
        customTag = customTag && customTag[1] ? customTag[1] : null;

        if (!customTag) {
            return null;
        }

        // html 处理
        var customNode = createCustomNode(html, customTag);
        var itemNode = document.createElement('div');
        itemNode.setAttribute('mip-custom-item', len);
        // 如果定制化组件属性有 no-padding 则把它的容器设置为 no-padding
        // 组件属性 no-padding 必须设置一个值，哪怕是""，不然会被remove
        if (customNode.hasAttribute('no-padding')) {
            itemNode.classList.add('no-padding');
        }
        // XXX work around: 由于需要在template渲染后把渲染结果插入到itemNode，container里面，
        // 只能把这些参数绑定在 customNode 里传给render.then中，通过res.element.itemNode获取
        customNode.itemNode = itemNode;
        customNode.container = container;

        if (customNode.hasAttribute('mip-fixed')) {
            moveToFixedLayer(element, customNode, container);
        }

        // 模板渲染
        templates.render(customNode, result, true).then(function (res) {
            res.element.innerHTML = res.html;
            // XXX: 在模板渲染resolve后把custom element插入到页面
            // 防止组件先插入页面后触发firstInviewCallback方法，但内容只有待渲染的template，
            // 此时在组件中获取不到渲染后dom，无法绑定事件
            res.element.itemNode.appendChild(res.element);
            res.element.container.appendChild(res.element.itemNode);

            if (res.element.hasAttribute('mip-fixed')
                && res.element.getAttribute('mip-fixed') === 'bottom') {
                moveToFixedLayer(element, customNode, container);
                fixedElement.setPlaceholder();
                var zIndex = getCss(res.element.parentNode, 'z-index');

                if (zIndex >= maxzIndex) {
                    maxzIndex = zIndex;
                    var now = Date.now();
                    var timer = setInterval(function () {
                        var height = getCss(res.element, 'height');
                        if (height > 0 || Date.now() - now > 8000) {
                            clearInterval(timer);
                        }
                        fixedElement.setPlaceholder(height - excr);
                    }, 16);
                }
            }
        });

        return customTag;
    }

    /**
     * [render dom 渲染]
     *
     * @param  {DOM}   element   mip-custom 节点
     * @param  {Array} tplData   渲染mustache模板的数据数组
     * @param  {DOM}   container 装载定制化组件节点的容器
     */
    function render(element, tplData, container) {
        for (var len = 0; len < tplData.length; len++) {

            // 某条结果为空时不渲染此条结果
            var result = tplData[len].tplData;
            if (!result || (result instanceof Array && !result.length)
                || (result instanceof Object && !Object.keys(result).length)) {
                continue;
            }

            // 某条结果 tpl 为空时不渲染此条结果
            var str = tplData[len].tpl ? decodeURIComponent(tplData[len].tpl) : null;
            if (!str) {
                continue;
            }

            // style 处理
            renderStyleOrScript(str, regexs.style, 'style', 'mip-custom-css', document.head);

            // html 处理
            var customTag = renderHtml(element, str, len, result, container);

            if (!customTag) {
                continue;
            }

            // script 处理
            renderStyleOrScript(str, regexs.script, 'script', customTag, document.body);

        }
    }

    /**
     * [proxyLink a 标签事件代理]
     *
     * @param  {DOM} element    mip-custom, 只监听当前组件下的 a 标签
     * @param  {DOM} fixedLayer fixed body
     */
    function proxyLink(element, fixedLayer) {
        util.event.delegate(element, 'a', 'click', function (event) {
            if (this.hasAttribute('mip-link') || /clk_info/.test(this.href)) {
                return;
            }

            // 处理需要单独发送日志的 a 标签
            var link = this.getAttribute('data-log-href');

            var path = null;
            if (fixedLayer) {
                path = log.getXPath(this, fixedLayer);
                path.unshift('.mip-fixedlayer');
            }
            else {
                path = log.getXPath(this, element);
            }
            var xpath = path ? path.join('_') : '';

            var logUrl = (link) ? link : this.href;
            logUrl += ((logUrl[logUrl.length - 1] === '&') ? '' : '&')
                      + 'clk_info=' + JSON.stringify({xpath: xpath});
            if (link) {
                log.sendLog(logUrl, {});
            }
            else {
                this.href = logUrl;
            }
        });
    }


    /**
     * [getConfigScriptElement 获取页面配置的content内容]
     * 不在此做解析
     *
     * @param  {HTMLElement} elem     mip-custom element 节点
     * @return {HTMLScriptElement}    返回`application/json`的script配置节点
     */
    function getConfigScriptElement(elem) {
        if (!elem) {
            return;
        }
        return elem.querySelector('script[type="application/json"]');
    }

    // 广告加载前loading效果
    function addPlaceholder() {
        var placeholder = document.createElement('div');
        this.placeholder = placeholder;
        placeholder.classList.add('mip-custom-placeholder');
        placeholder.setAttribute('mip-custom-container', '');
        placeholder.innerHTML = ''
            + '<span class="mip-custom-placeholder-title"></span>'
            + '<span class="mip-custom-placeholder-text text1"></span>'
            + '<span class="mip-custom-placeholder-text text2"></span>'
            + '<span class="mip-custom-placeholder-text text3"></span>'
            + '<span class="mip-custom-placeholder-space"></span>'
            + '<span class="mip-custom-placeholder-title"></span>'
            + '<span class="mip-custom-placeholder-text text1"></span>'
            + '<span class="mip-custom-placeholder-text text2"></span>'
            + '<span class="mip-custom-placeholder-text text3"></span>';
        this.element.appendChild(placeholder);
    }
    // 移除 广告占位
    function removePlaceholder() {
        var me = this;
        this.placeholder.classList.add('fadeout');
        // 占位符增加淡出效果
        this.placeholder.addEventListener('transitionend', function () {
            me.placeholder.remove();
        }, false);
        this.placeholder.addEventListener('webkitTransitionend', function () {
            me.placeholder.remove();
        }, false);
    }


    return {
        render: render,
        proxyLink: proxyLink,
        getConfigScriptElement: getConfigScriptElement,
        addPlaceholder: addPlaceholder,
        removePlaceholder: removePlaceholder
    };

});
