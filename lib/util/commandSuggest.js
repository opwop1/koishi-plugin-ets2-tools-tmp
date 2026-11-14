/**
 * 指令纠错：用户打错指令时给出「猜你想问」提示。
 *
 * 只提示、不自动执行 —— 避免把一个善意的纠正变成误操作。
 * 匹配用 Levenshtein（编辑距离），再叠加几条针对中文指令的实用规则。
 */

/**
 * Levenshtein 编辑距离（支持中文按字符计）。
 * 超过 max 时提前返回 max + 1，避免长串无谓计算。
 */
function levenshtein(a, b, max) {
    const s = String(a == null ? '' : a);
    const t = String(b == null ? '' : b);
    if (s === t) return 0;

    const n = s.length;
    const m = t.length;
    if (n === 0) return m;
    if (m === 0) return n;
    if (max != null && Math.abs(n - m) > max) return max + 1;

    // 滚动数组，只需两行
    let prev = new Array(m + 1);
    let curr = new Array(m + 1);
    for (let j = 0; j <= m; j++) prev[j] = j;

    for (let i = 1; i <= n; i++) {
        curr[0] = i;
        let rowMin = curr[0];
        const sc = s.charCodeAt(i - 1);

        for (let j = 1; j <= m; j++) {
            const cost = sc === t.charCodeAt(j - 1) ? 0 : 1;
            const v = Math.min(
                prev[j] + 1,        // 删除
                curr[j - 1] + 1,    // 插入
                prev[j - 1] + cost  // 替换
            );
            curr[j] = v;
            if (v < rowMin) rowMin = v;
        }

        if (max != null && rowMin > max) return max + 1;
        const tmp = prev; prev = curr; curr = tmp;
    }

    return prev[m];
}

/**
 * 指令名归一化：去掉参数部分、统一大小写与空白。
 * 例如「vtc里程排行 Simulation」→「vtc里程排行」
 */
function normalizeCommandText(raw) {
    return String(raw == null ? '' : raw)
        .trim()
        // 去掉前缀（如 . 或 /）
        .replace(/^[./#!]+/, '')
        // 只取第一段（指令名不含空格）
        .split(/\s+/)[0]
        .toLowerCase();
}

/**
 * 从一组候选指令里找出与输入最接近的。
 *
 * 规则（按优先级）：
 * 1. 完全相同 → 视为正确，返回 null（不需要提示）
 * 2. 输入是某个指令的「前缀/子串」且长度足够 → 高分（如「vtc里程排行」之于「vtc里程排行榜」）
 * 3. 编辑距离在阈值内 → 按距离排序
 *
 * @param {string} input 用户输入
 * @param {string[]} candidates 候选指令名
 * @param {object} [opts]
 * @param {number} [opts.maxDistance] 最大编辑距离，默认按输入长度自适应
 * @param {number} [opts.limit] 最多返回几个建议，默认 3
 * @returns {Array<{ name: string, distance: number, score: number }>}
 */
function suggestCommands(input, candidates, opts) {
    const options = opts || {};
    const limit = options.limit != null ? options.limit : 3;
    const raw = normalizeCommandText(input);
    if (!raw) return [];

    const list = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
    // 输入太短时不做纠错：一两个字符的指令（如「查询」）容易被误判
    if (raw.length < 2) return [];

    // 自适应阈值：短指令允许 1，长指令允许 2，避免误报
    const maxDistance = options.maxDistance != null
        ? options.maxDistance
        : (raw.length <= 3 ? 1 : 2);

    const scored = [];
    for (const name of list) {
        const target = normalizeCommandText(name);
        if (!target) continue;
        if (target === raw) return [];   // 完全匹配 → 这是有效指令，不该提示

        const distance = levenshtein(raw, target, maxDistance);

        let score = 0;
        // 前缀关系优先判断（优先级高于纯编辑距离）：
        // 用户在指令名后多打了字（「路况查询」之于「路况」），本质上是对的指令 + 多余参数
        const isTargetPrefixOfRaw = raw.length > target.length && raw.startsWith(target) && target.length >= 2;
        const isRawPrefixOfTarget = target.length > raw.length && target.startsWith(raw) && raw.length >= 2;

        if (isRawPrefixOfTarget) {
            // 用户少打了字（「vtc里程排行」→「vtc里程排行榜」）——最常见，给最高分
            score = 120 - (target.length - raw.length);
        } else if (isTargetPrefixOfRaw) {
            // 用户多打了字 —— 次高，且多余字符越少越可能
            score = 110 - (raw.length - target.length);
        } else if (distance <= maxDistance) {
            score = 100 - distance * 10;
        }

        if (score > 0) {
            scored.push({ name: target, distance, score, len: target.length });
        }
    }

    scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.distance !== b.distance) return a.distance - b.distance;
        // 同分同距离时，更长的名字优先：
        // 「路况查询」应更倾向「路况」（原指令带多余参数）而不是短名「查询」
        if (b.len !== a.len) return b.len - a.len;
        return a.name.localeCompare(b.name);
    });

    return scored.slice(0, limit).map(({ name, distance, score }) => ({ name, distance, score }));
}

module.exports = {
    levenshtein,
    normalizeCommandText,
    suggestCommands,
};
