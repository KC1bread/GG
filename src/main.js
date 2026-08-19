import './style.css';
import { RelativisticVoyagerApp } from './core/App.js';
import { applyStatic, bindLangButtons } from './i18n/i18n.js';
import { showErrorBanner } from './core/ErrorBanner.js';

// 渲染静态文本（data-i18n）并绑定开场语言切换按钮
applyStatic();
bindLangButtons();

// 全局错误捕获：白屏/崩溃时显示具体错误信息，便于排查
window.addEventListener('error', (e) => {
  console.error('[RV] 全局错误：', e.error || e.message);
  const msg = (e.error && e.error.message) || e.message || String(e.error);
  const stack = e.error && e.error.stack
    ? e.error.stack.split('\n').slice(0, 4).join('\n')
    : '';
  showErrorBanner('页面运行时错误 Runtime Error', msg + (stack ? '\n' + stack : ''));
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('[RV] 未处理的 Promise 拒绝：', e.reason);
  showErrorBanner('异步错误 Unhandled Rejection', (e.reason && e.reason.message) || String(e.reason));
});

const app = new RelativisticVoyagerApp();
app.init();
window.rvApp = app;
