/**
 * QQ 官方机器人：直接构造原生的 markdown + keyboard 消息。
 *
 * 为什么不用 Koishi 元素层：
 * - `<button-group>` 里用 `<br>` 分隔行**无效**（适配器不处理 br，所有按钮挤一行）；
 * - 每个按钮一个 `<button-group>` 会产生**空行**（适配器 flush 时多 push 了空数组）；
 * - 结果就是按钮被压缩成「再...」「我...」这种省略号。
 *
 * 所以这里绕过元素层，直接拼 QQ 官方的 payload：
 *   { msg_type: 2, markdown: { content }, keyboard: { content: { rows } } }
 * 这样每一行放几个按钮完全可控。
 */

const qqOfficial = require('./qqOfficial');

const MSG_TIMEOUT = 5 * 60 * 1000 - 2000;

/** 取 logger（容错） */
function getLogger(session) {
    return (session && session.app && session.app.logger) ||
        (session && session.bot && session.bot.logger) ||
        null;
}

/**
 * 构造单个按钮的原生结构（与适配器 decodeButton 保持一致）。
 *
 * 支持两种入参写法：
 * - 原生风格：{ label, type: 'input'|'link'|'callback', text|href|id, primary }
 * - 便捷风格：{ label, text }        → 自动视为 input 按钮
 * - 便捷风格：{ label, href }        → 自动视为 link 按钮
 * - 也可直接传 qqOfficial.inputButton() 产出的元素，自动转换
 *
 * @returns {object} QQ 官方按钮结构
 */
function nativeButton(opts) {
    const o = opts || {};

    // 已经是原生结构（有 render_data + action）→ 幂等返回，避免二次转换把 label 清空
    if (o.render_data && o.action) {
        return {
            render_data: {
                label: String(o.render_data.label == null ? '' : o.render_data.label),
                visited_label: String(o.render_data.visited_label == null ? o.render_data.label || '' : o.render_data.visited_label),
                style: o.render_data.style === 1 ? 1 : 0,
            },
            action: {
                type: o.action.type === 2 ? 2 : o.action.type === 0 ? 0 : 1,
                permission: { type: 2 },
                data: String(o.action.data == null ? '' : o.action.data),
            },
        };
    }

    // 已经是 Koishi 元素（inputButton 等的产出）：从 attrs 里取
    let label, type, text, href, id, primary;
    if (o.type && o.attrs) {
        const a = o.attrs || {};
        label = String(Array.isArray(o.children) ? o.children.join('') : '');
        type = a.type || 'input';
        text = a.text;
        href = a.href;
        id = a.id;
        primary = a.class === 'primary';
    } else {
        label = String(o.label == null ? '' : o.label);
        type = o.type || (o.href ? 'link' : 'input');
        text = o.text;
        href = o.href;
        id = o.id;
        primary = !!o.primary;
    }

    const actionType = type === 'input' ? 2 : type === 'link' ? 0 : 1;
    let data = '';
    if (actionType === 2) data = String(text == null ? '' : text);
    else if (actionType === 0) data = String(href == null ? '' : href);
    else data = String(id == null ? '' : id);

    return {
        render_data: {
            label,
            visited_label: label,
            style: primary ? 1 : 0,
        },
        action: {
            type: actionType,
            permission: { type: 2 },
            data,
        },
    };
}

/**
 * 把「按钮行」转成原生 keyboard 结构。
 * @param {Array<Array<object>>} rows 行数组；每行是若干按钮
 * @returns {object|null} keyboard；无按钮返回 null
 */
function buildKeyboard(rows) {
    if (!Array.isArray(rows)) return null;
    const out = [];
    for (const row of rows) {
        if (!Array.isArray(row) || row.length === 0) continue;
        out.push({ buttons: row.map(nativeButton) });
    }
    // QQ 键盘最多 5 行，每行最多 5 个按钮
    const limited = out.slice(0, 5).map(r => ({ buttons: r.buttons.slice(0, 5) }));
    return limited.length ? { content: { rows: limited } } : null;
}

/**
 * 发送一条「markdown 正文 + 按钮」的官方消息（一条消息，不是多条）。
 *
 * @param {object} session koishi session
 * @param {object} content
 * @param {string} content.markdown markdown 正文
 * @param {Array<Array<object>>} [content.buttons] 按钮行
 * @returns {Promise<object|null>} 发送结果；不支持时返回 null（调用方回退到元素层）
 */
async function sendMarkdownWithButtons(session, content) {
    const c = content || {};
    const markdown = String(c.markdown == null ? '' : c.markdown);

    const bot = session && session.bot;
    if (!bot || !bot.internal) return null;

    const keyboard = buildKeyboard(c.buttons);

    // 被动回复：群聊用 msg_id（同一消息内可多次回复，msg_seq 递增）
    const data = {
        msg_type: 2,
        markdown: { content: markdown || ' ' },
        msg_id: undefined,
        msg_seq: undefined,
        event_id: undefined,
    };
    if (keyboard) data.keyboard = keyboard;

    // 复用被动回复窗口（5 分钟内可以 msg_id 连续回复）
    const now = Date.now();
    if (session.messageId && session.timestamp && now - session.timestamp < MSG_TIMEOUT) {
        session['seq'] = (session['seq'] || 0) + 1;
        data.msg_id = session.messageId;
        data.msg_seq = session['seq'];
    } else if (session.qq && session.qq.id && session.timestamp && now - session.timestamp < MSG_TIMEOUT) {
        data.event_id = session.qq.id;
    } else if (session.messageId) {
        data.msg_id = session.messageId;
        data.msg_seq = 1;
    }

    const log = getLogger(session);
    const send = async () => {
        if (log) {
            // 只打印关键信息，避免刷屏
            const mdPreview = String(data.markdown.content || '').replace(/\n/g, '\\n');
            log.info(`[markdown发送] channel=${session.channelId} isDirect=${!!session.isDirect} `
                + `msg_id=${data.msg_id || '-'} msg_seq=${data.msg_seq || '-'} event_id=${data.event_id || '-'} `
                + `rows=${data.keyboard ? data.keyboard.content.rows.length : 0} `
                + `能含图片=${/!\[[^\]]*\]\([^)]*\)/.test(data.markdown.content)} `
                + `content=${mdPreview.slice(0, 120)}`);
        }
        if (session.isDirect) {
            return await bot.internal.sendPrivateMessage(session.channelId, data);
        }
        return await bot.internal.sendMessage(session.channelId, data);
    };

    try {
        return await send();
    } catch (error) {
        const detail = error && error.response && error.response.data
            ? JSON.stringify(error.response.data)
            : (error && error.message) || String(error);
        if (log) log.warn(`[markdown发送] 首次发送失败: ${detail}，尝试去掉被动回复头重发`);
        // 被动回复窗口过期：不带头重发一次
        const noPassive = !data.msg_id && !data.event_id;
        if (!noPassive) {
            delete data.msg_id;
            delete data.msg_seq;
            delete data.event_id;
            try {
                return await send();
            } catch (error2) {
                const d2 = error2 && error2.response && error2.response.data
                    ? JSON.stringify(error2.response.data)
                    : (error2 && error2.message) || String(error2);
                if (log) log.warn(`[markdown发送] 重发仍失败: ${d2}`);
                return null;
            }
        }
        return null;
    }
}

module.exports = {
    nativeButton,
    buildKeyboard,
    sendMarkdownWithButtons,
};
