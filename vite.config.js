import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [basicSsl()],
  server: {
    watch: {
      // Windows 上 chokidar 监听大纹理文件常触发 EBUSY（文件被 TextureLoader/系统缩略图锁住），
      // 且 PIT 纹理为静态资源，改动无需 HMR —— 从 watcher 中排除（不影响静态服务）。
      ignored: ['**/PIT/**', '**/dist/**'],
    },
  },
});
