'use strict';
/**
 * 极简 CDP 客户端(零依赖: 用 Node 22 内置的全局 WebSocket)
 * 只实现仿真站需要的能力: 建标签 / 注入脚本 / 导航 / 求值 / 收控制台日志。
 */

class CDP {
    constructor() {
        this.ws = null;
        this.nextId = 1;
        this.pending = new Map();
        this.listeners = [];
    }

    async connect(wsUrl) {
        this.ws = new WebSocket(wsUrl);
        await new Promise((resolve, reject) => {
            const to = setTimeout(() => reject(new Error('CDP 连接超时: ' + wsUrl)), 15000);
            this.ws.onopen = () => { clearTimeout(to); resolve(); };
            this.ws.onerror = (e) => { clearTimeout(to); reject(new Error('CDP WebSocket 错误: ' + (e && e.message))); };
        });
        this.ws.onmessage = (ev) => this._onMessage(typeof ev.data === 'string' ? ev.data : String(ev.data));
        return this;
    }

    _onMessage(raw) {
        let msg;
        try { msg = JSON.parse(raw); } catch (e) { return; }
        if (msg.id && this.pending.has(msg.id)) {
            const { resolve, reject } = this.pending.get(msg.id);
            this.pending.delete(msg.id);
            if (msg.error) reject(new Error(`${msg.method || ''}: ${msg.error.message}`));
            else resolve(msg.result);
            return;
        }
        for (const cb of this.listeners) {
            try { cb(msg); } catch (e) { /* 监听者异常不影响主流程 */ }
        }
    }

    send(method, params, sessionId) {
        const id = this.nextId++;
        const payload = { id, method, params: params || {} };
        if (sessionId) payload.sessionId = sessionId;
        this.ws.send(JSON.stringify(payload));
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            setTimeout(() => {
                if (this.pending.has(id)) {
                    this.pending.delete(id);
                    reject(new Error('CDP 超时: ' + method));
                }
            }, 60000);
        });
    }

    on(cb) { this.listeners.push(cb); return () => { this.listeners = this.listeners.filter((f) => f !== cb); }; }

    close() { try { this.ws && this.ws.close(); } catch (e) { /* ignore */ } }
}

module.exports = { CDP };
