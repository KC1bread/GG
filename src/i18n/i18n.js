/**
 * i18n — 轻量双语运行时（零依赖）
 *
 * 语言：
 *   zh   中文（默认；中英结合版转正，允许保留少量英文专业术语：
 *         measured / observed / Minkowski / Terrell / Lorentz 等）
 *   en   纯英文（不允许出现中文字符）
 *
 * 使用：
 *   t('key', { vars })      取当前语言字符串，支持 {placeholder}
 *   L({zh, en})             取数据对象中当前语言的值（用于行星数据等）
 *   setLang('en')           切换语言（持久化到 localStorage 并通知所有监听者）
 *   getLang()               当前语言
 *   onLangChange(fn)        订阅切换事件，返回取消函数
 *   applyStatic(scope)      渲染 [data-i18n] / [data-i18n-html] / [data-i18n-title] 节点
 */
import { STRINGS } from './strings.js';

const LS_KEY = 'rv-language';
const SUPPORTED = ['zh', 'en'];
const DEFAULT_LANG = 'zh';

let lang = loadLang();
const listeners = new Set();

function loadLang() {
  try {
    let v = localStorage.getItem(LS_KEY);
    if (v === 'zhEn') v = 'zh'; // 旧版本（三语时代）兼容
    if (v && SUPPORTED.includes(v)) return v;
  } catch (e) { /* ignore */ }
  return DEFAULT_LANG;
}

/** 当前语言 */
export function getLang() {
  return lang;
}

/** 当前语言的显示名（用于底栏/开场切换按钮） */
export function langLabel() {
  return t('lang.' + lang);
}

/** 切换语言并广播 */
export function setLang(next, { persist = true } = {}) {
  if (!SUPPORTED.includes(next) || next === lang) return;
  lang = next;
  if (persist) {
    try { localStorage.setItem(LS_KEY, next); } catch (e) { /* ignore */ }
  }
  applyHtmlLang();
  listeners.forEach((fn) => {
    try { fn(lang); } catch (e) { /* 单个监听者异常不影响其他 */ }
  });
}

/** 订阅语言变化，返回退订函数 */
export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 取字符串（自动回退 zh，再回退 key 本身） */
export function t(key, vars) {
  const table = STRINGS[lang] || STRINGS[DEFAULT_LANG];
  let s = table[key];
  if (s === undefined) s = STRINGS[DEFAULT_LANG][key];
  if (s === undefined) return key;
  if (vars) {
    for (const k of Object.keys(vars)) {
      s = s.split(`{${k}}`).join(String(vars[k]));
    }
  }
  return s;
}

/**
 * 取多语言数据值：value 为 {zh, en} 时按当前语言取值，
 * 纯字符串则原样返回（无需本地化的字段直接存字符串）。
 */
export function L(value) {
  if (value == null) return value;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return value[lang] ?? value.zhEn ?? value.en ?? value.zh ?? '';
  }
  return value;
}

/** 同步 <html lang> 与 lang-* 类（CSS 宽度适配依赖） */
export function applyHtmlLang() {
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
  document.documentElement.classList.remove('lang-en', 'lang-zh');
  document.documentElement.classList.add('lang-' + lang);
}

/** 渲染静态节点（默认整棵文档，也可限定 scope） */
export function applyStatic(scope = document) {
  scope.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  scope.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  scope.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
}

/** 语言切换按钮：绑定 [data-lang] 点击并同步 active 状态 */
export function bindLangButtons(scope = document) {
  scope.querySelectorAll('[data-lang]').forEach((btn) => {
    if (btn.dataset._langBound) return;
    btn.dataset._langBound = '1';
    btn.addEventListener('click', () => setLang(btn.dataset.lang));
  });
  syncLangButtons(scope);
}

/** 同步 [data-lang] 按钮的 active 状态 */
export function syncLangButtons(scope = document) {
  scope.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
}

/** 初始化：应用 <html lang>（供模块加载即生效） */
applyHtmlLang();

// 语言变化时自动同步所有语言按钮的 active 状态
onLangChange(() => syncLangButtons());
