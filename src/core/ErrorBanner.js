/**
 * ErrorBanner — 页面错误提示横幅
 * 初始化失败或运行时错误时在屏幕顶部显示具体信息（可关闭），
 * 避免"白屏 + 崩溃脸"且无从排查。
 */
let bannerEl = null;

export function showErrorBanner(title, detail) {
  try {
    if (!bannerEl) {
      bannerEl = document.createElement('div');
      bannerEl.className = 'rv-error-banner';
      bannerEl.innerHTML = `
        <div class="rv-error-banner-head">
          <strong></strong>
          <button class="rv-error-banner-close" aria-label="Close">×</button>
        </div>
        <pre class="rv-error-banner-body"></pre>
      `;
      bannerEl.querySelector('.rv-error-banner-close').addEventListener('click', () => {
        if (bannerEl) bannerEl.remove();
      });
      document.body.appendChild(bannerEl);
    }
    bannerEl.querySelector('strong').textContent = title;
    bannerEl.querySelector('pre').textContent = detail;
    bannerEl.classList.add('show');
  } catch (e) { /* 兜底：横幅自身失败不影响主流程 */ }
}
