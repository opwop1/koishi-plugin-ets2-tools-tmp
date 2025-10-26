declare function _exports(ctx: any, cfg: any, serverName: any): Promise<segment | "渲染异常，请重试" | "未启用 puppeteer 服务" | "请输入正确的服务器名称 (s1, s2, p, a)" | "查询路况信息失败">;
export = _exports;
import { segment } from "@koishijs/core";
