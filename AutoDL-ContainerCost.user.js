// ==UserScript==
// @name         AutoDL 按容器实例 ID 统计控制台费用
// @namespace    https://github.com/2086-H2O/AutoDL-ContainerCost
// @version      1.0.1
// @description  支持在 AutoDL 控制台的 费用 > 收支明细/我的订单 按照多个容器 ID 来统计支出费用
// @author       2086丷
// @match        https://www.autodl.com/console/*
// @match        https://autodl.com/console/*
// @match        https://www.autodl.com/console/cost/incomeExpend*
// @match        https://autodl.com/console/cost/incomeExpend*
// @match        https://www.autodl.com/console/cost/order/list*
// @match        https://autodl.com/console/cost/order/list*
// @icon         https://autodl.com/favicon.png
// @grant        none
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // 1. 拦截并偷取 authorization 凭证
    let authToken = localStorage.getItem('token') || '';

    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
        if (header.toLowerCase() === 'authorization') {
            authToken = value;
        }
        return originalSetRequestHeader.apply(this, arguments);
    };

    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const options = args[1] || {};
        if (options.headers) {
            if (options.headers instanceof Headers && options.headers.has('authorization')) {
                authToken = options.headers.get('authorization');
            } else if (options.headers['authorization'] || options.headers['Authorization']) {
                authToken = options.headers['authorization'] || options.headers['Authorization'];
            }
        }
        return originalFetch.apply(this, arguments);
    };

    // 2. 注入 Element UI 风格样式
    const style = document.createElement('style');
    style.innerHTML = `
        /* 原生 Element UI 按钮风格 */
        #autodl-cost-btn {
            display: inline-block;
            line-height: 1;
            white-space: nowrap;
            cursor: pointer;
            background: #3760F4;
            border: 1px solid #3760F4;
            color: #FFF;
            -webkit-appearance: none;
            text-align: center;
            box-sizing: border-box;
            outline: 0;
            margin: 0;
            transition: .1s;
            font-weight: 500;
            min-height: 32px;
            padding: 8px 15px;
            font-size: 14px;
            border-radius: 2px;
            min-width: 80px;
            margin-left: 12px;
            width: auto;
        }
        #autodl-cost-btn:hover {
            background: #5f80f6;
            border-color: #5f80f6;
        }
        #autodl-cost-btn:active {
            background: #0d3deb;
            border-color: #0d3deb;
        }

        /* 悬浮窗：固定在左下角，不再动态跟随 */
        #autodl-cost-panel {
            position: fixed;
            bottom: 30px;
            left: 30px;
            width: 320px;
            background: #ffffff;
            border: 1px solid #D7DAE0;
            border-radius: 4px;
            box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
            z-index: 2000;
            padding: 20px;
            box-sizing: border-box;
            display: none;
            transform: translateY(10px);
            opacity: 0;
            transition: opacity 0.3s cubic-bezier(0.23, 1, 0.32, 1),
                        transform 0.3s cubic-bezier(0.23, 1, 0.32, 1);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            will-change: opacity, transform;
        }
        #autodl-cost-panel.show {
            display: block;
            transform: translateY(0);
            opacity: 1;
        }
        #autodl-cost-panel h3 {
            margin: 0 0 12px 0;
            font-size: 16px;
            color: #333333;
            font-weight: 500;
        }
        #autodl-cost-panel textarea {
            width: 100%;
            height: 80px;
            border-radius: 2px;
            border: 1px solid #D7DAE0;
            padding: 8px;
            font-size: 13px;
            color: #666666;
            resize: none;
            box-sizing: border-box;
            outline: none;
            transition: border-color 0.2s cubic-bezier(0.645, 0.045, 0.355, 1);
        }
        #autodl-cost-panel textarea:focus {
            border-color: #3760F4;
        }
        #autodl-cost-panel textarea::placeholder {
            color: #999999;
        }

        /* 浮窗内的操作按钮 */
        #autodl-start-btn {
            width: 100%;
            margin-top: 12px;
            background: #3760F4;
            color: #FFF;
            border: 1px solid #3760F4;
            padding: 8px 15px;
            border-radius: 2px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: .1s;
        }
        #autodl-start-btn:hover {
            background: #5f80f6;
            border-color: #5f80f6;
        }
        #autodl-start-btn:disabled {
            background: #afbffb;
            border-color: #afbffb;
            cursor: not-allowed;
        }
        #autodl-close-btn {
            position: absolute;
            top: 20px;
            right: 20px;
            cursor: pointer;
            color: #999999;
            font-size: 14px;
            transition: color 0.2s;
        }
        #autodl-close-btn:hover {
            color: #666666;
        }
        #autodl-result-area {
            margin-top: 16px;
            font-size: 13px;
            color: #666666;
            line-height: 1.6;
        }
        .highlight-amount {
            font-size: 20px;
            font-weight: 500;
            color: #f56c6c;
        }
    `;
    document.head.appendChild(style);

    // 3. 构建悬浮窗 DOM
    const panel = document.createElement('div');
    panel.id = 'autodl-cost-panel';
    panel.innerHTML = `
        <span class="close-btn" id="autodl-close-btn">×</span>
        <h3 id="autodl-panel-title">按容器统计</h3>
        <p style="font-size: 12px; color: #999999; margin-bottom: 8px; margin-top: 0;">支持多个ID，用回车或逗号分隔</p>
        <textarea id="autodl-ids-input" placeholder="例如: 38a84e9xxx-6c413xxx\n简写: 38a84e9xxx / 6c413xxx"></textarea>
        <button id="autodl-start-btn">开始统计总额</button>
        <div id="autodl-result-area"></div>
    `;
    document.body.appendChild(panel);

    // 绑定关闭事件
    document.getElementById('autodl-close-btn').addEventListener('click', () => {
        panel.classList.remove('show');
    });

    // ==========================================
    // 4. 核心逻辑：SPA 路由监听
    // ==========================================
    setInterval(() => {
        // 利用 URL path 来精准判断页面
        const path = window.location.pathname;
        const isStatementPage = path.includes('/cost/incomeExpend');
        const isOrderPage = path.includes('/cost/order/list');
        const isRightPage = isStatementPage || isOrderPage;

        const btnExists = document.getElementById('autodl-cost-btn');

        if (isRightPage) {
            // 根据不同页面更新标题
            const titleEl = document.getElementById('autodl-panel-title');
            if (titleEl) {
                titleEl.innerText = isStatementPage ? '【收支明细】实例ID费用统计' : '【我的订单】实例ID费用统计';
            }

            // 如果在目标页面且按钮丢失，重新插入它
            if (!btnExists) {
                const filterItems = document.querySelectorAll('.filter-item');
                if (filterItems.length > 0) {
                    const lastFilterItem = filterItems[filterItems.length - 1];
                    const btn = document.createElement('button');
                    btn.id = 'autodl-cost-btn';
                    btn.innerText = '按实例ID统计';

                    lastFilterItem.parentNode.insertBefore(btn, lastFilterItem.nextSibling);

                    // 绑定唤醒浮窗事件
                    btn.addEventListener('click', () => {
                        panel.classList.add('show');
                    });
                }
            }
        } else {
            // 离开目标页面，收起面板
            if (panel.classList.contains('show')) {
                panel.classList.remove('show');
            }
        }
    }, 500);


    // 5. 扫描与统计核心业务逻辑
    const startBtn = document.getElementById('autodl-start-btn');
    const resultArea = document.getElementById('autodl-result-area');

    startBtn.addEventListener('click', async () => {
        const rawInput = document.getElementById('autodl-ids-input').value;
        const targetIds = rawInput.split(/[, \n]+/).map(id => id.trim()).filter(id => id.length > 0);

        if (targetIds.length === 0) {
            resultArea.innerHTML = '<span style="color: #FF9120;">⚠️ 请先输入至少一个容器实例 ID</span>';
            return;
        }

        if (!authToken) {
            authToken = localStorage.getItem('token') || '';
            if (!authToken) {
                resultArea.innerHTML = '<span style="color: #f56c6c;">❌ 未获取到认证 Token，请刷新页面。</span>';
                return;
            }
        }

        startBtn.disabled = true;
        resultArea.innerHTML = `正在初始化扫描...`;

        let totalCostInLi = 0;
        let matchCount = 0;
        let pageIndex = 1;
        let maxPage = 1;
        let dateMin = '9999-12-31';
        let dateMax = '0000-01-01';

        // 识别当前执行的是哪套 API
        const path = window.location.pathname;
        const isOrderPage = path.includes('/cost/order/list');

        const apiUrl = isOrderPage
            ? "https://autodl.com/api/v1/order/list"
            : "https://autodl.com/api/v1/bill/balance_statement/list";

        try {
            do {
                resultArea.innerHTML = `正在检索第 <b>${pageIndex}</b> 页...<br>(当前最大页数: ${maxPage})`;

                // 动态构建 Payload
                const reqBody = isOrderPage
                    ? {
                        "date_from": "", "date_to": "", "page_index": pageIndex, "page_size": 100,
                        "order_uuid": "", "product_type": "", "instance_uuid": ""
                      }
                    : {
                        "date_from": "", "date_to": "", "page_index": pageIndex, "page_size": 100,
                        "balance_statement_type": "expenditure", "bill_type": ""
                      };

                const response = await fetch(apiUrl, {
                    method: "POST",
                    headers: {
                        "authorization": authToken,
                        "content-type": "application/json;charset=UTF-8"
                    },
                    body: JSON.stringify(reqBody)
                });

                const json = await response.json();
                if (json.code !== "Success") {
                    throw new Error(json.msg || "接口响应异常");
                }

                const data = json.data;
                maxPage = data.max_page;

                for (const item of data.list) {
                    if (item.product_uuid && targetIds.some(targetId => item.product_uuid.includes(targetId))) {
                        totalCostInLi += isOrderPage ? (item.deal_price || 0) : (item.asset || 0);
                        matchCount++;

                        const currentDate = item.created_at.split('T')[0];
                        if (currentDate < dateMin) dateMin = currentDate;
                        if (currentDate > dateMax) dateMax = currentDate;
                    }
                }

                pageIndex++;
                if (pageIndex <= maxPage) {
                    await new Promise(r => setTimeout(r, 300));
                }

            } while (pageIndex <= maxPage);

            const finalRMB = (totalCostInLi / 1000).toFixed(2);
            let dateString = "无相关消费记录";
            if (matchCount > 0) {
                dateString = dateMin === dateMax ? dateMin : `${dateMin} 至 ${dateMax}`;
            }

            resultArea.innerHTML = `
                <div style="border-top: 1px dashed #D7DAE0; margin-top: 16px; padding-top: 12px;">
                    <div> 共统计到 <b>${matchCount}</b> 条记录</div>
                    <div style="margin: 6px 0;"> 账单跨度：<br>${dateString}</div>
                    <div style="margin-top: 10px;"> 累计金额：<br>
                        <span class="highlight-amount">￥${finalRMB}</span>
                    </div>
                </div>
            `;

        } catch (error) {
            resultArea.innerHTML = `<span style="color: #f56c6c;">❌ 扫描中断：${error.message}</span>`;
        } finally {
            startBtn.disabled = false;
        }
    });
})();
